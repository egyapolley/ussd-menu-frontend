const axios = require('axios')
const config  =require("./settings")

require("dotenv").config();




module.exports = {

    fetchBundles:async (msisdn) => {

        const url = "http://172.25.33.141:7002/bundles";
        try {
            const {data} = await axios.get(url,
                {
                    params: {
                        subscriberNumber: msisdn,
                        channel: "USSD"
                    },

                    auth: {
                        username: config.BUNDLE_QUERY_USER,
                        password: config.BUNDLE_QUERY_PASS
                    }
                });
            const {internetBundles,reason, status} = data;
            if (status === 0 && internetBundles.length > 0){
                const bundleMap = new Map();

                for (const bundle of internetBundles) {
                    bundleMap.set(bundle.name,bundle.bundles)
                }
                return  {
                    status :0,
                    bundles : bundleMap
                }

            }else {
                return {
                    status : 1,
                    message: reason.toString() || "System Error.Please try again"
                }
            }
        } catch (error) {
            console.log(error)
        }

    },
    checkMsisdnAllowed : async (msisdn) => {

        const url = "http://localhost:8900/checkValid";
        try {
            const {data} = await axios.get(url,
                {
                    params: {
                        contactId: msisdn,
                    },

                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },
    checkRetailorAllowed : async (contactId, distributorId) => {

        const url = "http://localhost:8900/checkValidRetail";
        try {
            const {data} = await axios.get(url,
                {
                    params: {
                        contactId,
                        distributorId
                    },

                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },

    changePINRetail : async (acctId,oldPIN, newPIN) => {

        const url = "http://localhost:8900/activate_retail";
        try {
            const postData ={
                acctId,
                oldPIN,
                newPIN,
                channel:'USSD'

            }
            const {data} = await axios.post(url,postData,
                {
                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },
    changePINDIST : async (acctId,oldPIN, newPIN) => {

        const url = "http://localhost:8900/activate_dist";
        try {
            const postData ={
                acctId,
                oldPIN,
                newPIN,
                channel:'USSD'

            }
            const {data} = await axios.post(url,postData,
                {
                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },

    getBalanceRetail : async (acctId, pin) => {

        const url = "http://localhost:8900/balance_retail";
        try {
            const {data} = await axios.get(url,
                {
                    params: {
                       acctId,
                        pin,
                        channel:"USSD"
                    },

                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },
    getBalanceDIST : async (acctId, pin) => {

        const url = "http://localhost:8900/balance_dist";
        try {
            const {data} = await axios.get(url,
                {
                    params: {
                        acctId,
                        pin,
                        channel:"USSD"
                    },

                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },


    cashTopSubRetail : async (acctId,msisdn,pin,amount,surfContact) => {

        const url = "http://localhost:8900/cash_top_sub";
        try {
            const postData ={
                acctId,
                pin,
                msisdn,
                amount,
                surfContact:surfContact?surfContact.toString():"",
                channel:'USSD'

            }
            const {data} = await axios.post(url,postData,
                {
                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },
    cashTopRetailDIST : async (acctId,pin,amount,retailorId) => {

        const url = "http://localhost:8900/cash_top_retail";
        try {
            const postData ={
                acctId,
                pin,
                amount,
                retailorId,
                channel:'USSD'

            }
            const {data} = await axios.post(url,postData,
                {
                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },

    checkExisting : async (msisdn) => {

        const url = "http://localhost:8900/checkExisting";
        try {
            const {data} = await axios.get(url,
                {
                    params: {
                        contactId: msisdn,
                    },

                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },
    createRetail : async (distributorId,contactId,pin,firstName,lastName,businessName) => {

        const url = "http://localhost:8900/create_retail";
        try {
            const postData ={
                distributorId,
                contactId,
                pin,
                firstName,
                lastName,
                businessName,
                channel:'USSD'

            }
            const {data} = await axios.post(url,postData,
                {
                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },



    dataTopSubRetail : async (acctId,msisdn,pin,bundleId,bundle_cost,bundle_value) => {

        const url = "http://localhost:8900/data_top_retail";
        try {
            const postData ={
                acctId,
                pin,
                msisdn,
                bundleId,
                bundle_cost,
                bundle_value,
                channel:'USSD'

            }
            const {data} = await axios.post(url,postData,
                {
                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },
   resetPIN : async (acctId,type) => {

        const url = "http://localhost:8900/reset_pin";
        try {
            const postData ={
                acctId,
                type,
                channel:'USSD'

            }
            const {data} = await axios.post(url,postData,
                {
                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
            return data

        } catch (error) {
            console.log(error)
            return {
                status:1,
                reason:"System Error. Please try again later"

            }
        }

    },

    checkPINValid : async (acctId,pin,type) => {

        const url = "http://localhost:8900/checkPINValid";
        try {
            const postData ={
                acctId,
                pin,
                type,
                channel:'USSD'

            }
            const {data} = await axios.post(url,postData,
                {
                    auth: {
                        username:config.USSD_USER,
                        password:config.USSD_PASS
                    }
                });
           const {status} = data
            return (status===0)

        } catch (error) {
            console.log(error)
            return false
        }

    },



}



