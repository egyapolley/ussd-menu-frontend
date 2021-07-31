const UssdMenu = require('ussd-menu-builder');
const express = require('express');
const helmet = require('helmet');
const {isMsisdnValid, isAmountValid, isPINValid, formatMSISDN, paginate} = require("./utils/sanitize_input")
const {fetchBundles} = require("./utils/rest_api");
const {isMsisdnActive} = require("./utils/soap_api");


const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({extended: false}));
require("dotenv").config();


let menu = new UssdMenu({provider: 'hubtel'});

let sessions = {}

const retailerIds = [
    '233249131147'

]

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
    run: () => {
        const {sessionId, phoneNumber} = menu.args
        let session = getSession(sessionId)
        session['phoneContact'] = phoneNumber;

        menu.con('SURFLINE. Choose option:' +
            '\n1) Check Cash Balance' +
            '\n2) Cash Top-Up' +
            '\n3) Data Bundle' +
            '\n4) Change PIN');
    },
    next: {
        '1': 'checkBalance',
        '2': 'cashTopUp',
        '3': 'dataBundle',
        '4': 'changePIN',
    },
});
// CHECK  BALANCE
menu.state('checkBalance', {
    run: () => {
        const bal = 24.0;
        menu.end('Your balance is GHC ' + bal);
    }
});

// CASH TOP-UP
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
    run: () => {
        const {sessionId, phoneNumber} = menu.args
        let input = menu.val
        if (!isMsisdnValid(input)) {
            menu.con('Invalid number. Please enter a VALID surfline number starting with 025')
        } else {
            const session = getSession(sessionId);
            if (input === session['surflineNumber']) {
                let msisdn = formatMSISDN(session['surflineNumber']);
                isMsisdnActive(msisdn)
                    .then(isActive => {
                        if (isActive) {
                            session['numberConfirmed'] = true;
                            menu.con('Enter Amount GHC: ')
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
                '\nAmount: GHC' + input + '\nPress 1 to CONTINUE or 2 to CANCEL')
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
    run: () => {
        let input = menu.val;
        if (!isPINValid(input)) {
            menu.end("Incorrect PIN. Operation aborted")
        } else {
            const session = getSession(menu.args.sessionId);
            session['pin'] = input;
            session['phoneContact'] = menu.args.phoneNumber;
            console.log(sessions)
            menu.end("Your request is being processed. Thank you")
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
            menu.con('Invalid PIN Length: Enter 6-digits PIN:');
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
            menu.con('Invalid PIN Length: Enter 6-digits PIN:');
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
    run: () => {
        const {sessionId, phoneNumber} = menu.args
        let input = menu.val
        if (!isPINValid(input)) {
            menu.con('Invalid PIN Length: Enter 6-digits PIN:')
        } else {
            const session = getSession(sessionId);
            if (input === session['new_pin']) {
                console.log(session)
                menu.end('PIN successfully updated')
            } else {
                menu.end('Number mismatch: Please check and try again')
            }
        }

    },
    next: {
        '*\\d+': 'changePIN.newPINConfirm'
    }

});

//BUY BUNDLE
menu.state('dataBundle', {
    run: () => {
        console.log(sessions)
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
                            fetchBundles(msisdn)
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
            }else {
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
            return session['bundleCatSelected'] && session['paginatedBundles']?'dataBundle.bundleSelect':'dataBundle.bundleCatSelected'

        }
    }
})
menu.state('dataBundle.bundleSelect',{
    run:() => {
        const {sessionId, phoneNumber} = menu.args
        const session = getSession(sessionId);
        const bundlesMap =  session['paginatedBundles']
        let input = menu.val
        if (input === '99'){
            let temp_bundles = session['bundles'];
            let totalPages = Math.ceil(temp_bundles.length/4)
            let footer = '\n99. More\n0. BACK'
            session['bundles_page'] = session['bundles_page'] && session['bundles_page'] <totalPages ? session['bundles_page'] + 1 : 1
            if (session['bundles_page'] >= totalPages && session['bundles_page'] !== 1) footer = '\n0. BACK'
            const mapPaginated = new Map();
            const paginateData = paginate(temp_bundles, session['bundles_page'])
            paginateData.forEach((value, index) => {
                mapPaginated.set(`${index + 1}`, value)
            })
            session['paginatedBundles'] = mapPaginated
            session['bundleSelected'] = false
            menu.con(`${stringifyBundles(mapPaginated)}${footer}`)
        }else if (input === '0'){
            let temp_bundles = session['bundles'];
            let footer = '\n99. More\n0. BACK'
            session['bundles_page'] = session['bundles_page'] && session['bundles_page'] > 2 ? session['bundles_page'] - 1 : 1
            if (session['bundles_page']===1) footer = '\n99. More'
            const mapPaginated = new Map();
            const paginateData = paginate(temp_bundles, session['bundles_page'])
            paginateData.forEach((value, index) => {
                mapPaginated.set(`${index + 1}`, value)
            })
            session['paginatedBundles'] = mapPaginated
            session['bundleSelected'] = false
            menu.con(`${stringifyBundles(mapPaginated)}${footer}`)
        }else if (!Array.from(bundlesMap.keys()).includes(input)){
            const tempList = Array.from(bundlesMap.keys())
            session['bundleSelected'] = false
            menu.con(`Invalid selection. Please choose between 1 and ${tempList.length}`)
        }else {
            session['bundleSelected'] = true
            const selectedBundle = bundlesMap.get(input)
            session['selectedBundle']=selectedBundle
            const {bundle_price,bundle_value} = selectedBundle
            menu.con('Data Top up : '+bundle_value + ' on ' + session['surflineNumber'] + '' +
                '\nCost: GHC' + bundle_price + '\nPress 1 to CONTINUE or 2 to CANCEL')
        }



    },
    next: {
        '*\\d+': function () {
            const session = getSession(menu.args.sessionId);
            return session['bundleSelected']?'dataBundle.PIN':'dataBundle.bundleSelect'

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
    run: () => {
        let input = menu.val;
        if (!isPINValid(input)) {
            menu.end("Incorrect PIN. Operation aborted")
        } else {
            const session = getSession(menu.args.sessionId);
            session['pin'] = input;
            session['phoneContact'] = menu.args.phoneNumber;
            console.log(sessions)
            menu.end("Your request is being processed. Thank you")
        }
    },

});

app.post('/ussd', async function (req, res) {


    const {Type, Mobile, Message, SessionId} = req.body

    if ((Type === 'initiation' && !Message)) {

        if (!retailerIds.includes(Mobile)) {
            delete sessions[SessionId]
            return res.send({
                Type: 'release',
                Message: 'Your phone Number is not allowed',
                SessionId
            })

        }


    }

    const resultMsg = await menu.run(req.body)
    res.send({...resultMsg, SessionId})


});

app.listen(8989, () => {
    console.log("App listening on http://localhost:8989/")
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
