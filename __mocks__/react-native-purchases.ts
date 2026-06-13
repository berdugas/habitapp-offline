const configure = jest.fn();
const logIn = jest.fn().mockResolvedValue({ customerInfo: {}, created: false });
const logOut = jest.fn().mockResolvedValue({});
const restorePurchases = jest.fn().mockResolvedValue({});
const syncPurchases = jest.fn().mockResolvedValue(undefined);
const getCustomerInfo = jest.fn().mockResolvedValue({});
const getOfferings = jest.fn().mockResolvedValue({ current: null, all: {} });
const purchasePackage = jest.fn().mockResolvedValue({ customerInfo: {} });

const Purchases = {
  configure,
  logIn,
  logOut,
  restorePurchases,
  syncPurchases,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
};

export default Purchases;
export {
  configure,
  logIn,
  logOut,
  restorePurchases,
  syncPurchases,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
};
