const soapRequest = require("easy-soap-request");
const parser = require('fast-xml-parser');
const he = require('he');
const options = {
    attributeNamePrefix: "@_",
    attrNodeName: "attr", //default is 'false'
    textNodeName: "#text",
    ignoreAttributes: true,
    ignoreNameSpace: true,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: false,
    trimValues: true,
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    parseTrueNumberOnly: false,
    arrayMode: false,
    attrValueProcessor: (val, attrName) => he.decode(val, {isAttributeValue: true}),
    tagValueProcessor: (val, tagName) => he.decode(val),
    stopNodes: ["parse-me-as-string"]
};

require("dotenv").config();


module.exports = {

    isMsisdnActive: async (msisdn) => {


        try {
            const url = "http://172.25.39.16:2222";
            const sampleHeaders = {
                'User-Agent': 'NodeApp',
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': 'http://SCLINSMSVM01P/wsdls/Surfline/MGMGetReferralAcctInfo/MGMGetReferralAcctInfo',
                'Authorization': 'Basic YWlhb3NkMDE6YWlhb3NkMDE='
            };

            let xmlBody = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mgm="http://SCLINSMSVM01P/wsdls/Surfline/MGMGetReferralAcctInfo.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <mgm:MGMGetReferralAcctInfoRequest>
         <CC_Calling_Party_Id>${msisdn}</CC_Calling_Party_Id>
      </mgm:MGMGetReferralAcctInfoRequest>
   </soapenv:Body>
</soapenv:Envelope>`;


            const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlBody, timeout: 5000});
            const {body} = response;
            let jsonObj = parser.parse(body, options);
            let jsonResult = jsonObj.Envelope.Body;
            let result = {}
            if (jsonResult.MGMGetReferralAcctInfoResult && jsonResult.MGMGetReferralAcctInfoResult.Result) {
                result.contact = jsonResult.MGMGetReferralAcctInfoResult.Result
                result.success = true;


            } else {
                result.contact = null;
                result.success = false;

            }
            return result;

        } catch (error) {
            console.log(error.toString())
            return {
                contact: null,
                success: false,
            }

        }

    }

}
