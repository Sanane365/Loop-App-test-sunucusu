declare module "iyzipay" {
  export type CheckoutBuyer = {
    id: string;
    name: string;
    surname: string;
    identityNumber: string;
    email: string;
    gsmNumber: string;
    registrationAddress: string;
    city: string;
    country: string;
    zipCode: string;
    ip: string;
  };

  export type CheckoutAddress = {
    address: string;
    contactName: string;
    city: string;
    country: string;
    zipCode: string;
  };

  export type CheckoutItem = {
    id: string;
    name: string;
    category1: string;
    itemType: "VIRTUAL";
    price: string;
  };

  export type CheckoutInitializeRequest = {
    locale: "tr";
    conversationId: string;
    price: string;
    paidPrice: string;
    currency: "TRY";
    basketId: string;
    paymentGroup: "PRODUCT";
    callbackUrl: string;
    buyer: CheckoutBuyer;
    billingAddress: CheckoutAddress;
    basketItems: CheckoutItem[];
  };

  export type CheckoutInitializeResponse = {
    status?: string;
    token?: string;
    paymentPageUrl?: string;
    checkoutFormContent?: string;
    errorCode?: string;
    errorMessage?: string;
  };

  export type CheckoutRetrieveRequest = {
    locale: "tr";
    conversationId: string;
    token: string;
  };

  export type CheckoutRetrieveResponse = {
    status?: string;
    paymentStatus?: string;
    conversationId?: string;
    paymentId?: string;
    price?: string;
    paidPrice?: string;
    currency?: string;
    fraudStatus?: number;
    errorCode?: string;
    errorMessage?: string;
  };

  export type IyzicoConfig = {
    apiKey: string;
    secretKey: string;
    uri: string;
  };

  export default class Iyzipay {
    constructor(config: IyzicoConfig);
    checkoutFormInitialize: {
      create(
        request: CheckoutInitializeRequest,
        callback: (error: Error | null, response: CheckoutInitializeResponse) => void,
      ): void;
    };
    checkoutForm: {
      retrieve(
        request: CheckoutRetrieveRequest,
        callback: (error: Error | null, response: CheckoutRetrieveResponse) => void,
      ): void;
    };
    static LOCALE: { TR: "tr" };
    static PAYMENT_GROUP: { PRODUCT: "PRODUCT" };
    static CURRENCY: { TRY: "TRY" };
    static BASKET_ITEM_TYPE: { VIRTUAL: "VIRTUAL" };
  }
}
