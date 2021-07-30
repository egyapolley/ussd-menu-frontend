module.exports = {
    isMsisdnValid : ( msisdn ) =>{
        msisdn = msisdn.trim().replace(/\\s+/g,"");
        msisdn  = msisdn && Number(msisdn);
        return msisdn && msisdn.toString().length > 8;
    },
    isAmountValid :(amount) =>{
        amount = amount.trim().replace(/\\s+/g,"");
        amount  = amount && Number(amount);
        return amount && amount >=1;

    },
    isPINValid: (pin) =>{
        pin = pin.trim().replace(/\\s+/g,"");
        pin  = pin && Number(pin);
        return pin && pin.toString().length ===6;

    }
}
