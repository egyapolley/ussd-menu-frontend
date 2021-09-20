const UssdMenu = require('ussd-menu-builder');
const express = require('express');
const helmet = require('helmet');
const {isMsisdnValid, isAmountValid, isPINValid, formatMSISDN, paginate} = require("./utils/sanitize_input")
const restApi = require("./utils/rest_api");
const passport = require("passport");
const BasicStrategy = require("passport-http").BasicStrategy;
const User = require("./models/user");
const {isMsisdnActive} = require("./utils/soap_api");

const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost/ussd-hubtel-frontend", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
}).then(()=>{
    console.log('MONGODB connected')


    const app = express();

    app.use(helmet());
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));
    require("dotenv").config();


    passport.use(new BasicStrategy(
        function (username, password, done) {
            User.findOne({username: username}, function (err, user) {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false);
                }
                user.comparePassword(password, function (error, isMatch) {
                    if (err) return done(error);
                    else if (isMatch) {
                        return done(null, user)
                    } else {
                        return done(null, false);
                    }

                })

            });
        }
    ));


    let menu = new UssdMenu({provider: 'hubtel'});

    let sessions = {}



    menu.sessionConfig({
        start: (sessionId, callback) => {
            if (!(sessionId in sessions)) sessions[sessionId] = {};
            callback();
        },
        end: (sessionId, callback) => {
            delete sessions[sessionId];
            callback();
        },
        set: (sessionId, key, value, callback) => {
            sessions[sessionId][key] = value;
            callback();
        },
        get: (sessionId, key, callback) => {
            let value = sessions[sessionId][key];
            callback(null, value);
        }

    });

    function getSession(sessionId) {
        return sessions[sessionId]

    }


    menu.startState({
        run: async () => {

            let {sessionId, phoneNumber} = menu.args

            let session = getSession(sessionId)
            phoneNumber = phoneNumber.toString().replace('+', '');

            const subData = await restApi.checkMsisdnAllowed(phoneNumber)
            if (subData.status !== 0) menu.end(subData.reason)

            session['phoneContact'] = phoneNumber
            session['acctType'] = subData.type
            session['acctState'] = subData.accountState

            if (session['acctState'] === 'CREATED') {
                session['firstTime'] = true
                menu.con('Your FIRST TIME.' +
                    '\n1) Change PIN' +
                    '\n2) Reset PIN')


            } else {
                delete session['firstTime']
                if (session['acctType'] === 'DISTRIBUTOR') {
                    session['distributor'] =true
                    menu.con('SURFLINE. Choose option:' +
                        '\n1) Check Your Balance' +
                        '\n2) Add New Retailor' +
                        '\n3) Transfer Cash' +
                        '\n4) Reset PIN');

                } else {
                    menu.con('SURFLINE. Choose option:' +
                        '\n1) Check Your Balance' +
                        '\n2) Transfer Cash' +
                        '\n3) Buy Bundle' +
                        '\n4) Reset PIN');

                }

            }


        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                const input = menu.val
                if (session['firstTime'] && session['acctType'] === 'RETAILOR') {
                    switch (input) {
                        case '1':
                            return 'changePIN'
                        case '2':
                            return 'resetPIN'
                    }
                } else if (session['firstTime'] && session['acctType'] === 'DISTRIBUTOR') {
                    switch (input) {
                        case '1':
                            return 'changePINDIST'
                        case '2':
                            return 'resetPIN'
                    }

                } else {
                    if (session['distributor']){
                        switch (input) {
                            case '1':
                                return 'checkBalanceDIST'
                            case '2':
                                return 'AddNewRetailorDIST'
                            case  '3':
                                return 'cashTopUpDIST'
                            case '4':
                                return 'changePINDIST'
                        }

                    }else {
                        switch (input) {
                            case '1':
                                return 'checkBalance'
                            case '2':
                                return 'cashTopUp'
                            case  '3':
                                return 'dataBundle'
                            case '4':
                                return 'changePIN'

                        }

                    }


                }


            }
        },
    });
// CHECK  BALANCE
    menu.state('checkBalance', {
        run: () => {
            menu.con('Enter 6-digits PIN')

        },
        next: {
            '*\\d+': 'handleCheckBalance'
        }
    });
    menu.state('handleCheckBalance', {
        run: async () => {
            const pin = menu.val
            const session = getSession(menu.args.sessionId);
            const result = await restApi.getBalanceRetail(session['phoneContact'], pin)
            if (result.status === 0) {
                menu.end(`Your current balance is GHC ${result.balance}`)
            } else {
                menu.end(result.reason)

            }


        },

    });

// CHECK  BALANCE DIST
    menu.state('checkBalanceDIST', {
        run: () => {
            menu.con('Enter 6-digits PIN')

        },
        next: {
            '*\\d+': 'handleCheckBalanceDIST'
        }
    });
    menu.state('handleCheckBalanceDIST', {
        run: async () => {
            const pin = menu.val
            const session = getSession(menu.args.sessionId);
            const result = await restApi.getBalanceDIST(session['phoneContact'], pin)
            if (result.status === 0) {
                menu.end(`Your current balance is GHC ${result.balance}`)
            } else {
                menu.end(result.reason)

            }


        },

    });

// CASH TOP-UP RETAILOR - SUBSCRIBER
    menu.state('cashTopUp', {

        run: () => {

            menu.con('Enter surfline number starting with 025:');
        },
        next: {
            '*\\d+': 'cashTopUp.number'
        }
    });
    menu.state('cashTopUp.number', {
        run: () => {
            const {sessionId, phoneNumber} = menu.args
            let input = menu.val
            if (!isMsisdnValid(input)) {
                menu.con('Invalid number. Please enter a VALID surfline number starting with 025')
            } else {
                const session = getSession(sessionId);
                session['surflineNumber'] = input;
                menu.con('Confirm surfline number:')
            }


        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['surflineNumber'] ? 'cashTop.confirmNumber' : 'cashTopUp.number'
            }
        }
    });
    menu.state('cashTop.confirmNumber', {
        run: async () => {
            const {sessionId, phoneNumber} = menu.args
            let input = menu.val
            if (!isMsisdnValid(input)) {
                menu.con('Invalid number. Please enter a VALID surfline number starting with 025')
            } else {
                const session = getSession(sessionId);
                if (input === session['surflineNumber']) {
                    let msisdn = formatMSISDN(session['surflineNumber']);
                    try {
                        const msisdnData = await isMsisdnActive(msisdn)
                        if (msisdnData.success) {
                            session['numberConfirmed'] = true;
                            session['surfContact'] = msisdnData.contact
                            menu.con('Enter Amount GHC: ')
                        } else {
                            menu.end(`Surfline number ${session['surflineNumber']} is not ACTIVE.`)

                        }
                    } catch (ex) {
                        menu.end(`Surfline number ${session['surflineNumber']} is not ACTIVE.`)
                    }


                } else {
                    menu.end('Number mismatch: Please check and try again')
                }
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['numberConfirmed'] ? "cashTopUp.Amount" : 'cashTop.confirmNumber';
            }
        }
    });
    menu.state('cashTopUp.Amount', {
        run: () => {
            const {sessionId, phoneNumber} = menu.args
            let input = menu.val
            if (!isAmountValid(input)) {
                menu.con('Invalid Amount. Amount should be greater than GHC 1.00')
            } else {
                const session = getSession(sessionId);
                session['amount'] = input;
                menu.con('Cash Top up : ' + session['surflineNumber'] + '' +
                    '\nAmount: GHC' + input + '\n\nPress 1 to CONTINUE \nPress 2 to CANCEL')
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['amount'] ? "cashTopUp.PIN" : 'cashTopUp.Amount';
            }
        }
    });
    menu.state('cashTopUp.PIN', {
        run: () => {
            let input = menu.val;

            switch (input) {
                case '1':
                    const session = getSession(menu.args.sessionId);
                    session['pin_entered'] = true;
                    menu.con('Enter 6-digits PIN')
                    break;
                case '2':
                    menu.end("Operation aborted.Thank you");
                    break;
                default:
                    menu.con('Invalid selection: Please choose between 1 and 2')
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['pin_entered'] ? "cashTopUp.FINAL" : 'cashTopUp.PIN';
            }
        }
    });
    menu.state('cashTopUp.FINAL', {
        run: async () => {
            let input = menu.val;
            if (!isPINValid(input)) {
                menu.end("Incorrect PIN. Operation aborted")
            } else {
                const session = getSession(menu.args.sessionId);
                session['pin'] = input;
                session['surflineNumber'] = `233${session['surflineNumber'].substring(1)}`

                const result = await restApi.cashTopSubRetail(session['phoneContact'], session['surflineNumber'], session['pin'], session['amount'], session['surfContact'])
                if (result.status === 0) menu.end(`GHC${session['amount']} successfully transfered to ${session['surflineNumber']}. Thank you `)
                else menu.end(result.reason)

            }
        },

    });


// CASH TOP-UP DISTRIBUTOR - RETAILOR
    menu.state('cashTopUpDIST', {

        run: () => {

            menu.con('Enter Retailor number:');
        },
        next: {
            '*\\d+': 'cashTopUpDIST.number'
        }
    });
    menu.state('cashTopUpDIST.number', {
        run: () => {
            const {sessionId} = menu.args
            let input = menu.val
            if (!isMsisdnValid(input)) {
                menu.con('Invalid number. Please enter a Valid Retailor number')
            } else {
                const session = getSession(sessionId);
                session['retailorNumber'] = input;
                menu.con('Confirm  Retailor number:')
            }


        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['retailorNumber'] ? 'cashTopDIST.confirmNumber' : 'cashTopUpDIST.number'
            }
        }
    });
    menu.state('cashTopDIST.confirmNumber', {
        run: async () => {
            const {sessionId} = menu.args
            let input = menu.val
            if (!isMsisdnValid(input)) {
                menu.con('Invalid number. Please enter a Retailor number starting')
            } else {
                const session = getSession(sessionId);
                if (input === session['retailorNumber']) {
                    let retailorMsisdn = formatMSISDN(session['retailorNumber']);
                    try {
                        session['phoneContact'] =menu.args.phoneNumber.replace('+','')
                        const retailStatus = await restApi.checkRetailorAllowed(retailorMsisdn,session['phoneContact'])
                        if (retailStatus.status===0) {
                            session['retailName']=retailStatus.data
                            session['numberConfirmed'] = true;
                            menu.con('Enter Amount GHC: ')
                        } else {
                            menu.end(retailStatus.reason)

                        }
                    } catch (ex) {
                        console.log(ex)
                        menu.end('System Error. Please try again')
                    }


                } else {
                    menu.end('Number mismatch: Please check and try again')
                }
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['numberConfirmed'] ? "cashTopUpDIST.Amount" : 'cashTopDIST.confirmNumber';
            }
        }
    });
    menu.state('cashTopUpDIST.Amount', {
        run: () => {
            const {sessionId, phoneNumber} = menu.args
            let input = menu.val
            if (!isAmountValid(input)) {
                menu.con('Invalid Amount. Amount should be greater than GHC 1.00')
            } else {
                const session = getSession(sessionId);
                session['amount'] = input;
                menu.con('Cash Top up : ' + session['retailorNumber']+'('+session['retailName']+')' + '' +
                    '\nAmount: GHC ' + input + '\n\nPress 1 to CONTINUE \nPress 2 to CANCEL')
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['amount'] ? "cashTopUpDIST.PIN" : 'cashTopUpDIST.Amount';
            }
        }
    });
    menu.state('cashTopUpDIST.PIN', {
        run: () => {
            let input = menu.val;

            switch (input) {
                case '1':
                    const session = getSession(menu.args.sessionId);
                    session['pin_entered'] = true;
                    menu.con('Enter 6-digits PIN')
                    break;
                case '2':
                    menu.end("Operation aborted.Thank you");
                    break;
                default:
                    menu.con('Invalid selection: Please choose between 1 and 2')
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['pin_entered'] ? "cashTopUpDIST.FINAL" : 'cashTopUpDIST.PIN';
            }
        }
    });
    menu.state('cashTopUpDIST.FINAL', {
        run: async () => {
            let input = menu.val;
            if (!isPINValid(input)) {
                menu.end("Incorrect PIN. Operation aborted")
            } else {
                const session = getSession(menu.args.sessionId);
                session['pin'] = input;
                session['retailorNumber'] = `233${session['retailorNumber'].substring(1)}`

                const result = await restApi.cashTopRetailDIST(session['phoneContact'], session['pin'], session['amount'],session['retailorNumber'])
                if (result.status === 0) menu.end(`GHC${session['amount']} successfully transfered to ${session['retailorNumber']}(${session['retailName']})}. Thank you `)
                else menu.end(result.reason)

            }
        },

    });

// CHANGE PIN
    menu.state('changePIN', {
        run: () => {
            menu.con('Enter OLD PIN:');
        },
        next: {
            '*\\d+': 'changePIN.oldPIN'
        }
    });
    menu.state('changePIN.oldPIN', {
        run: () => {
            let input = menu.val;
            if (!isPINValid(input)) {
                menu.con('Invalid PIN: Enter 6-digits PIN:');
            } else {
                const session = getSession(menu.args.sessionId);
                session['old_pin'] = input;
                menu.con('Enter New PIN:')
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['old_pin'] ? 'changePIN.newPIN' : 'changePIN.oldPIN';
            }
        }
    });
    menu.state('changePIN.newPIN', {
        run: () => {
            let input = menu.val;
            if (!isPINValid(input)) {
                menu.con('Invalid PIN: Enter 6-digits PIN:');
            } else {
                const session = getSession(menu.args.sessionId);
                session['new_pin'] = input;
                menu.con('Confirm New PIN:')
            }
        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['new_pin'] ? 'changePIN.newPINConfirm' : 'changePIN.newPIN';
            }
        }
    });
    menu.state('changePIN.newPINConfirm', {
        run: async () => {
            const {sessionId} = menu.args
            let input = menu.val
            if (!isPINValid(input)) {
                menu.con('Invalid PIN: Enter 6-digits PIN:')
            } else {
                const session = getSession(sessionId);
                if (input === session['new_pin']) {
                    const result = await restApi.changePINRetail(session['phoneContact'], session['old_pin'], input)
                    if (result.status === 0) menu.end('PIN successfully updated')
                    else menu.end(result.reason)
                } else {
                    menu.end('Number mismatch: Please check and try again')
                }
            }

        },
        next: {
            '*\\d+': 'changePIN.newPINConfirm'
        }

    });

// CHANGE PIN DISTRIBUTOR
    menu.state('changePINDIST', {
        run: () => {
            menu.con('Enter OLD PIN:');
        },
        next: {
            '*\\d+': 'changePINDIST.oldPIN'
        }
    });
    menu.state('changePINDIST.oldPIN', {
        run: () => {
            let input = menu.val;
            if (!isPINValid(input)) {
                menu.con('Invalid PIN: Enter 6-digits PIN:');
            } else {
                const session = getSession(menu.args.sessionId);
                session['old_pin'] = input;
                menu.con('Enter New PIN:')
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['old_pin'] ? 'changePINDIST.newPIN' : 'changePINDIST.oldPIN';
            }
        }
    });
    menu.state('changePINDIST.newPIN', {
        run: () => {
            let input = menu.val;
            if (!isPINValid(input)) {
                menu.con('Invalid PIN: Enter 6-digits PIN:');
            } else {
                const session = getSession(menu.args.sessionId);
                session['new_pin'] = input;
                menu.con('Confirm New PIN:')
            }
        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['new_pin'] ? 'changePINDIST.newPINConfirm' : 'changePINDIST.newPIN';
            }
        }
    });
    menu.state('changePINDIST.newPINConfirm', {
        run: async () => {
            const {sessionId} = menu.args
            let input = menu.val
            if (!isPINValid(input)) {
                menu.con('Invalid PIN: Enter 6-digits PIN:')
            } else {
                const session = getSession(sessionId);
                if (input === session['new_pin']) {
                    const result = await restApi.changePINDIST(session['phoneContact'], session['old_pin'], input)
                    if (result.status === 0) menu.end('PIN successfully updated')
                    else menu.end(result.reason)
                } else {
                    menu.end('Number mismatch: Please check and try again')
                }
            }

        },

    });


//RESET PIN
    menu.state('resetPIN', {
        run: async () => {
            const session = getSession(menu.args.sessionId);
            session['phoneContact'] = menu.args.phoneNumber.toString().replace('+', '');
            const result = await restApi.resetPIN(session['phoneContact'], session['acctType'])
            if (result.status === 0) menu.end('Your request is being processed. You will receive SMS soon with new PIN');
            else menu.end(result.reason)

        },
    });
//BUY BUNDLE
    menu.state('dataBundle', {
        run: () => {
            menu.con('Enter surfline number starting with 025:');
        },
        next: {
            '*\\d+': 'dataBundle.number'
        }
    });
    menu.state('dataBundle.number', {
        run: () => {
            const {sessionId, phoneNumber} = menu.args
            let input = menu.val
            if (!isMsisdnValid(input)) {
                menu.con('Invalid number. Please enter a VALID surfline number starting with 025')
            } else {
                const session = getSession(sessionId);
                session['surflineNumber'] = input;
                menu.con('Confirm surfline number:')
            }


        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['surflineNumber'] ? 'dataBundle.confirmNumber' : 'dataBundle.number'
            }
        }
    });
    menu.state('dataBundle.confirmNumber', {
        run: () => {
            const {sessionId, phoneNumber} = menu.args
            let input = menu.val
            if (!isMsisdnValid(input)) {
                menu.con('Invalid number. Please enter a VALID surfline number starting with 025')
            } else {
                const session = getSession(sessionId);
                if (input === session['surflineNumber']) {
                    session['numberConfirmed'] = true;
                    let msisdn = formatMSISDN(session['surflineNumber']);
                    isMsisdnActive(msisdn)
                        .then(isActive => {
                            if (isActive) {
                                restApi.fetchBundles(msisdn)
                                    .then(bundleResult => {
                                        const {status} = bundleResult;
                                        if (status === 0) {
                                            const {bundles} = bundleResult
                                            session['allBundles'] = bundles
                                            session['allBundleCat'] = mapBundleCat(bundles.keys())
                                            menu.con(stringifyBundleCat(session['allBundleCat']))
                                        } else {
                                            menu.end(`${bundleResult.message || "Error occurred.Please try Again"}`)
                                        }


                                    }).catch(error => {
                                    console.log(error)
                                    menu.end(`Error occurred.Please try Again.`)

                                })


                            } else {
                                menu.end(`Surfline number ${session['surflineNumber']} is not ACTIVE.`)
                            }

                        }).catch(error => {
                        menu.end(`Surfline number ${session['surflineNumber']} is not ACTIVE.`)

                    })

                } else {
                    menu.end('Number mismatch: Please check and try again')
                }
            }
        },
        next: {
            '*\\d+': 'dataBundle.bundleCatSelected'
        }
    });
    menu.state('dataBundle.bundleCatSelected', {
        run: () => {
            const {sessionId, phoneNumber} = menu.args
            let input = menu.val
            const session = getSession(sessionId);
            const catMap = session['allBundleCat']
            if (!Array.from(catMap.keys()).includes(input)) {
                const tempList = Array.from(catMap.keys())
                menu.con(`Invalid selection. Please choose between 1 and ${tempList.length}`)
            } else {
                session['bundleCatSelected'] = true;
                const catSelected = catMap.get(input)
                session['bundles'] = session['allBundles'].get(catSelected);
                let temp_bundles = session['bundles'];
                if (temp_bundles.length > 4) {
                    let footer = '\n99. More'
                    session['total_bundles'] = temp_bundles.length;
                    if (!session['bundles_page']) session['bundles_page'] = 1

                    const paginateData = paginate(temp_bundles, session['bundles_page'])
                    const mapPaginated = new Map();
                    paginateData.forEach((value, index) => {
                        mapPaginated.set(`${index + 1}`, value)
                    })
                    session['paginatedBundles'] = mapPaginated
                    menu.con(`${stringifyBundles(mapPaginated)}${footer}`)
                } else {
                    const mapPaginated = new Map();
                    temp_bundles.forEach((value, index) => {
                        mapPaginated.set(`${index + 1}`, value)
                    })
                    session['paginatedBundles'] = mapPaginated
                    menu.con(`${stringifyBundles(mapPaginated)}`)
                }

            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['bundleCatSelected'] && session['paginatedBundles'] ? 'dataBundle.bundleSelect' : 'dataBundle.bundleCatSelected'

            }
        }
    })
    menu.state('dataBundle.bundleSelect', {
        run: () => {
            const {sessionId, phoneNumber} = menu.args
            const session = getSession(sessionId);
            const bundlesMap = session['paginatedBundles']
            let input = menu.val
            if (input === '99') {
                let temp_bundles = session['bundles'];
                let totalPages = Math.ceil(temp_bundles.length / 4)
                let footer = '\n99. More\n0. BACK'
                session['bundles_page'] = session['bundles_page'] && session['bundles_page'] < totalPages ? session['bundles_page'] + 1 : 1
                if (session['bundles_page'] >= totalPages && session['bundles_page'] !== 1) footer = '\n0. BACK'
                const mapPaginated = new Map();
                const paginateData = paginate(temp_bundles, session['bundles_page'])
                paginateData.forEach((value, index) => {
                    mapPaginated.set(`${index + 1}`, value)
                })
                session['paginatedBundles'] = mapPaginated
                session['bundleSelected'] = false
                menu.con(`${stringifyBundles(mapPaginated)}${footer}`)
            } else if (input === '0') {
                let temp_bundles = session['bundles'];
                let footer = '\n99. More\n0. BACK'
                session['bundles_page'] = session['bundles_page'] && session['bundles_page'] > 2 ? session['bundles_page'] - 1 : 1
                if (session['bundles_page'] === 1) footer = '\n99. More'
                const mapPaginated = new Map();
                const paginateData = paginate(temp_bundles, session['bundles_page'])
                paginateData.forEach((value, index) => {
                    mapPaginated.set(`${index + 1}`, value)
                })
                session['paginatedBundles'] = mapPaginated
                session['bundleSelected'] = false
                menu.con(`${stringifyBundles(mapPaginated)}${footer}`)
            } else if (!Array.from(bundlesMap.keys()).includes(input)) {
                const tempList = Array.from(bundlesMap.keys())
                session['bundleSelected'] = false
                menu.con(`Invalid selection. Please choose between 1 and ${tempList.length}`)
            } else {
                session['bundleSelected'] = true
                const selectedBundle = bundlesMap.get(input)
                session['selectedBundle'] = selectedBundle
                const {bundle_price, bundle_value} = selectedBundle
                menu.con('Data Top up : ' + bundle_value + ' on ' + session['surflineNumber'] + '' +
                    '\nCost: GHC ' + bundle_price + '\n\nPress 1 to CONTINUE \nPress 2 to CANCEL')
            }


        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['bundleSelected'] ? 'dataBundle.PIN' : 'dataBundle.bundleSelect'

            }
        }
    })
    menu.state('dataBundle.PIN', {
        run: () => {
            let input = menu.val;

            switch (input) {
                case '1':
                    const session = getSession(menu.args.sessionId);
                    session['pin_entered'] = true;
                    menu.con('Enter 6-digits PIN')
                    break;
                case '2':
                    menu.end("Operation aborted.Thank you");
                    break;
                default:
                    menu.con('Invalid selection: Please choose between 1 and 2')
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['pin_entered'] ? "dataBundle.FINAL" : 'dataBundle.PIN';
            }
        }
    });
    menu.state('dataBundle.FINAL', {
        run: async () => {
            let input = menu.val;
            if (!isPINValid(input)) {
                menu.end("Incorrect PIN. Operation aborted")
            } else {
                const session = getSession(menu.args.sessionId);
                session['pin'] = input;
                session['phoneContact'] = menu.args.phoneNumber.toString().replace('+', '');
                session['surflineNumber'] = `233${session['surflineNumber'].substring(1)}`

                const {bundle_value, bundle_id,bundle_price} = session['selectedBundle']
                const result = await restApi.dataTopSubRetail(session['phoneContact'], session['surflineNumber'], session['pin'], bundle_id,bundle_price,bundle_value)
                if (result.status === 0) menu.end(`${bundle_value} successfully purchased on ${session['surflineNumber']}. Thank you`)
                else menu.end(result.reason)
            }
        },

    });


//ADD RETAILOR
    menu.state('AddNewRetailorDIST', {

        run: () => {

            menu.con('Enter Retailor First Name:');
        },
        next: {
            '*[a-zA-Z]+': 'AddNewRetailorDIST.firstName'
        }
    });
    menu.state('AddNewRetailorDIST.firstName', {
        run: () => {
            const {sessionId} = menu.args
            let input = menu.val
            if (!(input.trim() && input.length >0)) {
                menu.con('Name is invalid. Please enter a valid name')
            } else {
                const session = getSession(sessionId);
                session['firstName'] = input;
                menu.con('Enter Retailor Last Name:')
            }


        },
        next: {
            '*[a-zA-Z]+': function () {
                const session = getSession(menu.args.sessionId);
                return session['firstName'] ? 'AddNewRetailorDIST.lastName' : 'AddNewRetailorDIST.firstName'
            }
        }
    });
    menu.state('AddNewRetailorDIST.lastName', {
        run: async () => {
            const {sessionId} = menu.args
            let input = menu.val
            if (!(input.trim() && input.length >0)) {
                menu.con('Name is invalid. Please enter a valid name')
            } else {
                const session = getSession(sessionId);
                session['lastName'] = input;
                menu.con('Enter Retailor Business Name:')

            }

        },
        next: {
            '*[a-zA-Z0-9]+': function () {
                const session = getSession(menu.args.sessionId);
                return session['lastName'] ? 'AddNewRetailorDIST.businessName' : 'AddNewRetailorDIST.lastName'
            }
        }
    });
    menu.state('AddNewRetailorDIST.businessName', {
        run: async () => {
            const {sessionId} = menu.args
            let input = menu.val
            if (!(input.trim() && input.length >0)) {
                menu.con('Name is invalid. Please enter a valid name')
            } else {
                const session = getSession(sessionId);
                session['businessName'] = input;
                menu.con('Enter Retailor Phone Contact:')

            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['businessName'] ? 'AddNewRetailorDIST.retailorId' : 'AddNewRetailorDIST.businessName'
            }
        }
    });
    menu.state('AddNewRetailorDIST.retailorId', {
        run: () => {
            const {sessionId} = menu.args
            let input = menu.val
            if (!isMsisdnValid(input)) {
                menu.con('Invalid number. Please enter a Valid phone number')
            } else {
                const session = getSession(sessionId);
                session['retailorId'] = input;
                menu.con('Confirm  Retailor Phone Number:')
            }


        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['retailorId'] ? 'AddNewRetailorDIST.confirmRetailorId' : 'AddNewRetailorDIST.retailorId'
            }
        }
    });
    menu.state('AddNewRetailorDIST.confirmRetailorId', {
        run: async () => {
            const {sessionId} = menu.args
            let input = menu.val
            if (!isMsisdnValid(input)) {
                menu.con('Invalid number. Please enter a Valid phone number')
            } else {
                const session = getSession(sessionId);


                if (input === session['retailorId']) {

                    let msisdn = formatMSISDN(session['retailorId']);
                    const retailorStatus =await restApi.checkExisting(msisdn)
                    if (retailorStatus.status === 0){
                        session['retailorIdConfirmed'] = true;
                        session['retailorId']=msisdn
                        menu.con(`SUMMARY:\nName: ${session['firstName']} ${session['lastName']}\nBusiness:${session['businessName']}\nContact:${session['retailorId']}\n\nPress 1 to CONTINUE \nPress 2 to CANCEL`)

                    }else {
                        menu.end(retailorStatus.reason)
                    }


                } else {
                    menu.end('Number mismatch: Please check and try again')
                }


            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['retailorIdConfirmed'] ? 'AddNewRetailorDIST.summary' : 'AddNewRetailorDIST.confirmRetailorId'
            }
        }
    });
    menu.state('AddNewRetailorDIST.summary', {
        run: () => {
            let input = menu.val;

            switch (input) {
                case '1':
                    const session = getSession(menu.args.sessionId);
                    session['pin_entered'] = true;
                    menu.con('Enter 6-digits PIN')
                    break;
                case '2':
                    menu.end("Operation aborted.Thank you");
                    break;
                default:
                    menu.con('Invalid selection: Please choose between 1 and 2')
            }

        },
        next: {
            '*\\d+': function () {
                const session = getSession(menu.args.sessionId);
                return session['pin_entered'] ? "AddNewRetailorDIST.PIN" : 'AddNewRetailorDIST.summary';
            }
        }
    });
    menu.state('AddNewRetailorDIST.PIN', {
        run: async () => {
            let input = menu.val;
            if (!isPINValid(input)) {
                menu.end("Incorrect PIN. Operation aborted")
            } else {
                const session = getSession(menu.args.sessionId);
                session['pin'] = input;
                session['phoneContact']=menu.args.phoneNumber.replace('+','')
                const [pin,distributorId,contactId,firstName,lastName,businessName] =[session['pin'],session['phoneContact'],session['retailorId'],session['firstName'],session['lastName'],session['businessName']]

                const result = await restApi.createRetail(distributorId,contactId,pin,firstName,lastName,businessName)
                if (result.status === 0) menu.end(`Retailor Number ${session['retailorId']}(${session['businessName']}) successfully created. Thank you `)
                else menu.end(result.reason)

            }
        },

    });


    app.post('/ussd', async function (req, res) {


        const {Type, Mobile, Message, SessionId} = req.body

        if ((Type === 'initiation' && !Message)) {

            const data = await restApi.checkMsisdnAllowed(Mobile)
            if (data.status !== 0) {
                delete sessions[SessionId]
                return res.send({
                    Type: 'release',
                    Message: data.reason,
                    SessionId
                })
            }
        }


        const resultMsg = await menu.run(req.body)
        res.send({...resultMsg, SessionId})


    });
    app.post("/user", async (req, res) => {
        try {
            let {username, password, channel} = req.body;
            let user = new User({
                username,
                password,
                channel
            });
            user = await user.save();
            res.json(user);

        } catch (error) {
            res.json({error: error.toString()})
        }


    });

    app.listen(process.env.PORT, () => {
        console.log(`App listening on http://localhost:${process.env.PORT}/`)
    })
})
    .catch(error =>{
        console.log('MONGODB DB connection Failure')
        console.log(error)


    })




function mapBundleCat(dataList) {
    let catMap = new Map();
    Array.from(dataList).forEach((value, index) => {
        catMap.set(`${index + 1}`, value)
    })
    return catMap;
}

function stringifyBundleCat(catMap) {
    let keys = Array.from(catMap.keys()).sort();
    return keys.map(key => `${key}) ${catMap.get(key)}`).join('\n')

}

function stringifyBundles(mapBundles) {
    let keys = Array.from(mapBundles.keys()).sort();
    return keys.map(key => `${key})${mapBundles.get(key).bundle_menu_message}`).join('\n')

}
