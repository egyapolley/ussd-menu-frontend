const _ = require('lodash')
module.exports = {
    isMsisdnValid: (msisdn) => {
        msisdn = msisdn.trim().replace(/\\s+/g, "");
        msisdn = msisdn && Number(msisdn);
        return msisdn && msisdn.toString().length === 9;
    },
    isAmountValid: (amount) => {
        amount = amount.trim().replace(/\\s+/g, "");
        amount = amount && Number(amount);
        return amount && amount >= 1;

    },
    isPINValid: (pin) => {
        pin = pin.trim().replace(/\\s+/g, "");
        let regex =/[0-9]{6}/
        if (pin.length !== 6) return false
        return regex.test(pin)

    },

    formatMSISDN: (msisdn) => {
        return `233${msisdn.substring(1)}`;

    },
    paginate: (items, page=1, pageSize=4) => {
        let offset = (page - 1) * pageSize;
        return _.drop(items, offset).slice(0, pageSize)

    }
}
