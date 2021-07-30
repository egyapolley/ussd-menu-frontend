const UssdMenu = require('ussd-menu-builder');
const express = require('express');
const helmet = require('helmet');
const {isMsisdnValid, isAmountValid, isPINValid} = require("./utils/sanitize_input")


const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({extended: false}));


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
            console.log(session)
            if (input === session['surflineNumber']) {
                session['numberConfirmed'] = true;
                menu.con('Enter Amount GHC: ')
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
                '\nAmount: GHC' + input + ' Press 1 to CONTINUE or 2 to CANCEL')
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
            console.log(session)
            if (input === session['surflineNumber']) {
                session['numberConfirmed'] = true;
                menu.con('Select Bundle: ')
            } else {
                menu.end('Number mismatch: Please check and try again')
            }
        }
    },
    next: {
        '*\\d+': function () {
            const session = getSession(menu.args.sessionId);
            return session['numberConfirmed'] ? "dataBundle.bundleName" : 'dataBundle.confirmNumber';
        }
    }
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
