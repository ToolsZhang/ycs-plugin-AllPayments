import { createHash } from 'crypto'
import * as rp from 'request-promise'
import { urls } from './urls'
import * as utils from './utils'

export interface IConfig {
    appid: string // APP ID
    mch_id: string // 商户 ID
    apiKey: string // 微信商户平台API密钥
    pfx: Buffer // p12文件位置
}

export interface IOrderParams {
    body: string
    out_trade_no: string
    total_fee: number
    spbill_create_ip: string
    notify_url: string
    trade_type: 'APP' | 'JSAPI' | 'NATIVE' | 'MWEB' // APP, JSAPI, NATIVE etc.

    device_info?: string // 终端设备号(门店号或收银设备ID)，注意：PC网页或公众号内支付请传"WEB"
    detail?: string // 商品详情
    attach?: string // 附加数据
    time_start?: string // 交易起始时间 格式为yyyyMMddHHmmss
    time_expire?: string // 交易结束时间 格式为yyyyMMddHHmmss
    goods_tag?: string // 商品标记
    product_id?: string // 商品ID
    limit_pay?: string // 指定支付方式
    openid?: string // 用户标识
    scene_info?: {
        h5_info?: {
            type: 'IOS' | 'Android' | 'Wap'
            app_name?: string
            bundle_id?: string
            package_name?: string
            wap_url?: string
            wap_name?: string
        }
        store_info?: {
            id?: string
            name?: string
            area_code?: string
            address?: string
        }
    }
}

export interface IOrderResult {
    return_code: 'SUCCESS' | 'FAIL'
    return_msg: string
    appid: string
    mch_id: string
    nonce_str: string
    sign: string
    result_code: 'SUCCESS' | 'FAIL'
    prepay_id: string
    trade_type: 'JSAPI' | 'APP' | 'NATIVE' | 'MWEB'
}

export interface IQueryOrderParams {
    out_trade_no?: string
    transaction_id?: string
}

export interface IQueryOrderResult {
    return_code: 'SUCCESS' | 'FAIL'
    return_msg: string
    appid: string
    mch_id: string // 'your merchant id',
    nonce_str: 'P6IFNTlKWVKtlOH4'
    sign: string
    result_code: string
    out_trade_no: string
    trade_state: string
    trade_state_desc: string
}

export interface ICloseResult {
    return_code: 'SUCCESS' | 'FAIL'
    return_msg: string
    appid: string
    mch_id: string
    nonce_str: string
    sign: string
    result_code: string
}

export interface IPayment {
    partnerid: string // merchant id
    prepayid: string // prepay id
    noncestr: string // nonce
    timestamp: string // timestamp
    sign: string // signed string
}

export interface IRefundParams extends IQueryOrderParams {
    out_refund_no: string
    total_fee: number
    refund_fee: number
    refund_fee_type?: string
    refund_desc?: string
    refund_account?: string
}

export interface IRefundResult {
    return_code: 'SUCCESS' | 'FAIL'
    return_msg: string
    appid: string
    mch_id: string
    nonce_str: string
    sign: string
    result_code: string
    transaction_id: string
    out_trade_no: string
    out_refund_no: string
    refund_id: string
    refund_channel: string
    refund_fee: string
    coupon_refund_fee: string
    total_fee: string
    cash_fee: string
    coupon_refund_count: string
    cash_refund_fee: string
}

export interface IQueryRefundParams {
    out_trade_no?: string
    transaction_id?: string
    out_refund_no?: string
    refund_id?: string
}

export interface IQueryRefundResult {
    appid: string
    cash_fee: string
    mch_id: string
    nonce_str: string
    out_refund_no_0: string
    out_trade_no: string
    refund_channel_0: string
    refund_count: string
    refund_fee: string
    refund_fee_0: string
    refund_id_0: string
    refund_recv_accout_0: string
    refund_status_0: string
    result_code: string
    return_code: string
    return_msg: string
    sign: string
    total_fee: string
    transaction_id: string
}

export class Wechatpay {
    private __config: IConfig
    constructor(config: IConfig) {
        this.__config = config
    }
    // 注意tsc时需要转成 readonly config :
    get config(): IConfig {
        return this.__config
    }

    public async createUnifiedOrder(orderParams: IOrderParams): Promise<IOrderResult> {
        const order: any = Object.assign({}, orderParams)
        order.nonce_str = order.nonce_str || utils.createNonceStr()
        order.appid = this.config.appid
        order.mch_id = this.config.mch_id
        if (order.scene_info) {
            order.scene_info = JSON.stringify(order.scene_info)
        }
        order.sign = utils.sign(order, this.config.apiKey)
        const requestParam = {
            url: urls.UNIFIED_ORDER,
            method: 'POST',
            body: utils.buildXML(order),
        }
        const res = await rp(requestParam)
        const xml = await utils.parseXML(res)
        return xml
    }

    public configForPayment(orderResult: IOrderResult): IPayment {
        switch (orderResult.trade_type) {
            case 'JSAPI':
                return this.configForJSAPIPayment(orderResult)
            default:
                return this.configForAppPayment(orderResult)
        }
    }

    private configForJSAPIPayment(orderResult: IOrderResult): IPayment {
        const configData: any = {
            appId: this.config.appid,
            package: 'prepay_id=' + orderResult.prepay_id,
            nonceStr: utils.createNonceStr(),
            timeStamp: Math.floor(new Date().getTime() / 1000),
            signType: 'MD5',
        }
        configData.paySign = utils.sign(configData, this.config.apiKey)
        configData.timestamp = configData.timeStamp
        delete configData.timeStamp
        return configData
    }

    private configForAppPayment(orderResult: IOrderResult): IPayment {
        const configData: any = {
            appid: this.config.appid,
            partnerid: this.config.mch_id,
            prepayid: orderResult.prepay_id,
            package: 'Sign=WXPay',
            noncestr: utils.createNonceStr(),
            timestamp: Math.floor(new Date().getTime() / 1000),
        }
        configData.sign = utils.sign(configData, this.config.apiKey)
        return configData
    }

    public async queryOrder(queryParams: IQueryOrderParams): Promise<IQueryOrderResult> {
        const query = queryParams as any
        query.nonce_str = query.nonce_str || utils.createNonceStr()
        query.appid = this.config.appid
        query.mch_id = this.config.mch_id
        query.sign = utils.sign(query, this.config.apiKey)

        const res = await rp({
            url: urls.ORDER_QUERY,
            method: 'POST',
            body: utils.buildXML({ xml: query }),
        })
        const xml = await utils.parseXML(res)
        return xml
    }

    public async closeOrder(orderParams: IQueryOrderParams): Promise<ICloseResult> {
        const order = orderParams as any
        order.nonce_str = order.nonce_str || utils.createNonceStr()
        order.appid = this.config.appid
        order.mch_id = this.config.mch_id
        order.sign = utils.sign(order, this.config.apiKey)

        const res = await rp({
            url: urls.CLOSE_ORDER,
            method: 'POST',
            body: utils.buildXML({ xml: order }),
        })
        const xml = await utils.parseXML(res)
        return xml
    }

    public async refund(orderParams: IRefundParams): Promise<IRefundResult> {
        const order = orderParams as any
        order.nonce_str = order.nonce_str || utils.createNonceStr()
        order.appid = this.config.appid
        order.mch_id = this.config.mch_id
        order.sign = utils.sign(order, this.config.apiKey)

        const res = await rp({
            url: urls.REFUND,
            method: 'POST',
            body: utils.buildXML({ xml: order }),
            agentOptions: {
                pfx: this.config.pfx,
                passphrase: this.config.mch_id,
            },
        })
        const xml = await utils.parseXML(res)
        return xml
    }

    public async queryRefund(orderParams: IQueryRefundParams): Promise<IQueryRefundResult> {
        const order = orderParams as any
        if (!(order.transaction_id || order.out_trade_no || order.out_refund_no || order.refund_id))
            throw new Error('缺少参数')

        order.nonce_str = order.nonce_str || utils.createNonceStr()
        order.appid = this.config.appid
        order.mch_id = this.config.mch_id
        order.sign = utils.sign(order, this.config.apiKey)

        const res = await rp({
            url: urls.REFUND_QUERY,
            method: 'POST',
            body: utils.buildXML({ xml: order }),
        })
        const xml = await utils.parseXML(res)
        return xml
    }

    public signVerify(notification: any): boolean {
        const dataForSign = Object.assign({}, notification)
        delete dataForSign.sign
        const signValue = utils.sign(dataForSign, this.config.apiKey)
        return signValue === notification.sign
    }

    public success(): string {
        return utils.buildXML({
            xml: { return_code: 'SUCCESS', return_msg: 'OK' },
        })
    }

    public fail(): string {
        return utils.buildXML({ xml: { return_code: 'FAIL', return_msg: '签名失败' } })
    }
}
