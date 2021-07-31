const {paginate} = require("./utils/sanitize_input")
let  list =[
    'All Weather',
    'Unlimited',
    'AlwaysON',
    'Extension',
    'Pay Weekly1',
    'All Weather1',
    'Unlimited1',
    'AlwaysON1',
    'Extension2',
    'Pay Weekly2',
    'All Weather2',
    'Unlimited2',
    'AlwaysON3',
    'Extension3',
    'Pay Weekly3',
    'All Weather3',
    'Unlimited4',
    'AlwaysON4',
    'Extension4',
    'Pay Weekly4',
    'Pay Weekly5',
    'Pay Weekly6',
]

console.log(paginate(list,1))
console.log(paginate(list,2));
console.log(paginate(list,3))
console.log(paginate(list,6))


