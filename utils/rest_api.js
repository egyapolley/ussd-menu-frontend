const axios = require('axios')

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
                        username: `${process.env.BUNDLE_QUERY_USER}`,
                        password: `${process.env.BUNDLE_QUERY_PASS}`
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


}



