/* global ethereum */
import React from 'react' // eslint-disable-line
import { Plugin } from '@remixproject/engine'
import { JsonDataRequest, RejectRequest, SuccessRequest } from '../providers/abstract-provider'
import { IProvider } from './abstract-provider'

export abstract class InjectedProvider extends Plugin implements IProvider {
  options: { [id: string] : any } = {}

  constructor (profile) {
    super(profile)
  }

  abstract getInjectedProvider(): any
  abstract notFound(): string

  askPermission (throwIfNoInjectedProvider) {
    const web3Provider = this.getInjectedProvider()
    if (typeof web3Provider !== "undefined" && typeof web3Provider.request === "function") {
      web3Provider.request({ method: "eth_requestAccounts" })
    } else if (throwIfNoInjectedProvider) {
      throw new Error(this.notFound())
    }
  }

  body (): JSX.Element {
    return (
      <div></div>
    )
  }

  async init () {
    const injectedProvider = this.getInjectedProvider()
    if (injectedProvider === undefined) {
      this.call('notification', 'toast', this.notFound())
      throw new Error(this.notFound())
    } else {
      this.askPermission(true)
    }
    return {}
  }

  sendAsync (data: JsonDataRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.sendAsyncInternal(data, resolve, reject)
    })
  }

  private async sendAsyncInternal (data: JsonDataRequest, resolve: SuccessRequest, reject: RejectRequest): Promise<void> {
    // Check the case where current environment is VM on UI and it still sends RPC requests
    // This will be displayed on UI tooltip as 'cannot get account list: Environment Updated !!'
    const web3Provider = this.getInjectedProvider()
    if (!web3Provider) {
      this.call('notification', 'toast', 'No injected provider (e.g Metamask) has been found.')
      return reject(new Error('no injected provider found.'))
    }
    try {
      if ((window as any) && typeof web3Provider.request === "function") web3Provider.request({ method: "eth_requestAccounts" });
      const resultData = await web3Provider.send(data.method, data.params)
      resolve({ jsonrpc: '2.0', result: resultData.result, id: data.id })
    } catch (error) {
      reject(error)
    }
  }
}
