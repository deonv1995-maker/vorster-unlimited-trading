(function(){
'use strict';
const roles={
 Management:['Manufacturing','Finishing & Painting','Orders','Delivery Schedule','Collection Schedule','Stock','Planning'],
 Office:['Import / Update Orders','Order Status','Delivery Schedule','Collection Schedule'],
 Casting:['Today’s Casting','Casting Stock'],
 Packing:['Today’s Packing','Packing Stock'],
 Resin:['Today’s Resin','Resin Stock'],
 Painting:['Finishing & Painting','Finished Stock'],
 Delivery:['Today’s Deliveries','Collections']
};
window.VUFactoryOSRoles=roles;
window.VUFactoryRoles=roles;
})();