import { EnvironmentInjector, inject, Injectable } from '@angular/core';
import { WalletActionService } from '../wallet-action.service';
import { WalletService } from '../wallet.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { KaspaNetworkActionsService } from '../kaspa-netwrok-services/kaspa-network-actions.service';
import { AppWallet } from '../../classes/AppWallet';
import { BalanceData } from '../../types/kaspa-network/balance-event.interface';
import { Subscription } from 'rxjs';
import { CommitRevealAction, WalletAction } from '../../types/wallet-action';
import { WalletActionResultWithError } from '../../types/wallet-action-result';
import { EIP1193ProviderEventEnum, EIP1193ProviderRequestActionResult, ERROR_CODES, WalletActionRequestPayloadInterface, WalletActionResultType, WalletActionTypeEnum, WalletMessageInterface, WalletMessageTypeEnum } from 'kaspacom-wallet-messages';
import { Router } from '@angular/router';
import { EthereumWalletActionsService } from '../etherium-services/etherium-wallet-actions.service';
import { EthereumWalletChainManager } from '../etherium-services/etherium-wallet-chain.manager';
import { BaseCommunicationApp } from './communication-app/base-communication-app';

@Injectable({
    providedIn: 'root',
})
export class CommunicationManagerService {
    protected walletBalanceObservableSubscription: undefined | Subscription =
        undefined;
    protected currentWalletIdWithAccount: string | undefined = undefined;

    protected walletActionsService: WalletActionService = inject(WalletActionService);
    protected walletService: WalletService = inject(WalletService);
    protected kaspaNetworkActionsService: KaspaNetworkActionsService = inject(KaspaNetworkActionsService);
    protected injector: EnvironmentInjector = inject(EnvironmentInjector);
    protected router: Router = inject(Router);
    protected ethereumWalletActionsService: EthereumWalletActionsService = inject(EthereumWalletActionsService);
    protected ethereumWalletChainManager: EthereumWalletChainManager = inject(EthereumWalletChainManager);


    protected connectedApps: BaseCommunicationApp[] = [];
    protected eventsSubscriptions: Subscription[] = [];

    constructor() {
        this.eventsSubscriptions.push(toObservable(this.walletService.getCurrentWalletSignal()).subscribe(
            this.onWalletSelected.bind(this)
        ));
        this.eventsSubscriptions.push(toObservable(this.ethereumWalletChainManager.getCurrentChainSignal()).subscribe(
            () => {
                this.sendEtheriumWalletEvent(EIP1193ProviderEventEnum.CHAIN_CHANGED);
            }
        ));
    }

    protected stopEventsSenders() {
        this.eventsSubscriptions.forEach(subscription => subscription.unsubscribe());
    }

    protected async sendMessageToConnectedApps(message: WalletMessageInterface, specificApp?: BaseCommunicationApp) {
        if (specificApp) {
            specificApp.sendMessage(message);
        } else {
            this.connectedApps.forEach(app => app.sendMessage(message));
        }
    }

    async addApp(app: BaseCommunicationApp) {
        this.connectedApps.push(app);
        await this.initMessagaingForApp(app);
    }

    removeApp(app: BaseCommunicationApp) {
        app.disconnect();
        this.connectedApps.splice(this.connectedApps.indexOf(app), 1);
    }

    async initMessagaingForApp(app: BaseCommunicationApp) {
        await app.setOnMessageEventHandler((message: WalletMessageInterface) => this.onMessageFromApp(message, app));
    }

    protected async onMessageFromApp(message: WalletMessageInterface, app: BaseCommunicationApp) {
        if (message?.type) {
            switch (message.type) {
                case WalletMessageTypeEnum.WalletActionRequest:
                    await this.handleWalletActionRequest(message.payload, message.uuid, app);
                    break;
                case WalletMessageTypeEnum.OpenWalletInfo:
                    this.router.navigate(['/wallet-info']);
                    break;
                case WalletMessageTypeEnum.RejectWalletActionRequest:
                    this.walletActionsService.resolveCurrentWaitingForApproveAction(false);
                    break;
            }
        }
    }

    protected async onWalletSelected(wallet: AppWallet | undefined) {
        if (wallet?.getIdWithAccount() != this.currentWalletIdWithAccount) {
            this.walletBalanceObservableSubscription?.unsubscribe();
            this.walletBalanceObservableSubscription = undefined;
        }

        this.currentWalletIdWithAccount = wallet?.getIdWithAccount();


        if (wallet && !this.walletBalanceObservableSubscription) {
            this.walletBalanceObservableSubscription = toObservable(
                wallet.getWalletUtxoStateBalanceSignal(),
                { injector: this.injector }
            ).subscribe(this.onWalletBalanceUpdated.bind(this));
        }

        this.sendUpdateWalletInfoEvent(wallet);
        this.sendEtheriumWalletEvent(EIP1193ProviderEventEnum.ACCOUNTS_CHANGED);
    }

    protected async onWalletBalanceUpdated(balance: undefined | BalanceData) {
        await this.sendUpdateWalletInfoEvent(this.walletService.getCurrentWallet());
    }

    protected async sendUpdateWalletInfoEvent(wallet: AppWallet | undefined) {
        const message: WalletMessageInterface = {
            type: WalletMessageTypeEnum.WalletInfo,
            payload: undefined,
        };

        if (wallet) {
            const balance = wallet.getUtxoProcessorManager()?.getContext()
                ?.balance;
            message.payload = {
                walletAddress: wallet.getAddress(),
                kasplexL2Address: wallet.getL2WalletStateSignal()()?.address,
                balance:
                    balance?.mature === undefined
                        ? null
                        : {
                            current: this.kaspaNetworkActionsService.sompiToNumber(balance.mature),
                            pending: this.kaspaNetworkActionsService.sompiToNumber(balance.pending),
                            outgoing: this.kaspaNetworkActionsService.sompiToNumber(balance.outgoing),
                        },
            };
        }

        this.sendMessageToConnectedApps(message);
    }

    protected async handleWalletActionRequest(
        actionData: WalletActionRequestPayloadInterface,
        uuid?: string,
        app?: BaseCommunicationApp,
    ) {
        let result: WalletActionResultWithError = {
            success: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
        };

        if (!this.walletService.getCurrentWallet()) {
            result = {
                success: false,
                errorCode: ERROR_CODES.WALLET_ACTION.WALLET_NOT_SELECTED,
            }
        } else {
            if (actionData.action == WalletActionTypeEnum.GetProtocolScriptData) {
                result = {
                    success: true,
                    result: await this.kaspaNetworkActionsService.createGenericScriptFromString(
                        actionData.data.type,
                        actionData.data.stringifyAction,
                        this.walletService.getCurrentWallet()!.getAddress(),
                    ) as any,
                }
            } else if (actionData.action == WalletActionTypeEnum.EIP1193ProviderRequest) {
                result = {
                    success: true,
                    result: {
                        type: WalletActionResultType.EIP1193ProviderRequest,
                        performedByWallet: this.walletService.getCurrentWallet()!.getAddress(),
                        result: await this.ethereumWalletActionsService.handleRequest(actionData.data, async () => { await this.notifyActionAccepted(actionData, uuid); }),
                    } as EIP1193ProviderRequestActionResult<any>,
                }
            } else {
                let action: WalletAction | undefined =
                    this.getMessageWalletAction(actionData);

                if (action) {
                    result = await this.walletActionsService.validateAndDoActionAfterApproval(
                        action,
                        true,
                        async () => { await this.notifyActionAccepted(actionData, uuid); },
                    );
                }
            }
        }


        await this.sendMessageToConnectedApps({
            type: WalletMessageTypeEnum.WalletActionResponse,
            uuid,
            payload: result.success
                ? {
                    action: actionData.action,
                    success: true,
                    data: result.result,
                }
                : {
                    action: actionData.action,
                    success: false,
                    errorCode: result.errorCode || ERROR_CODES.GENERAL.UNKNOWN_ERROR,
                } as any,
        }, app);
    }

    protected async notifyActionAccepted(actionData: WalletActionRequestPayloadInterface, uuid: string | undefined) {
        await this.sendMessageToConnectedApps({
            type: WalletMessageTypeEnum.WalletActionApproved,
            uuid,
            payload: actionData,
        })
    }

    protected getMessageWalletAction(
        actionData: WalletActionRequestPayloadInterface
    ): WalletAction | undefined {
        switch (actionData.action) {
            case WalletActionTypeEnum.SignMessage:
                return this.walletActionsService.createSignMessageAction(
                    actionData.data.message
                );

            case WalletActionTypeEnum.CommitReveal:

                const transformedData: CommitRevealAction = {
                    actionScript: {
                        stringifyAction: actionData.data.actionScript.stringifyAction,
                        type: actionData.data.actionScript.type as any,
                    },
                    options: {
                        ...actionData.data.options as any,
                        additionalOutputs: actionData.data.options?.additionalOutputs?.map(
                            (output) => ({
                                ...output,
                                amount: this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
                                    output.amount
                                ),
                            })
                        ),
                        revealPriorityFee: actionData.data.options?.revealPriorityFee ? this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
                            actionData.data.options?.revealPriorityFee
                        ) : undefined,
                        revealPskt: actionData.data.options?.revealPskt ? {
                            script: actionData.data.options?.revealPskt?.script,
                            outputs: actionData.data.options?.revealPskt?.outputs?.map(
                                (output) => ({
                                    ...output,
                                    amount: this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
                                        output.amount
                                    ),
                                })
                            )
                        } : undefined,


                    }
                }

                return this.walletActionsService.createCommitRevealAction(
                    transformedData,
                );

            case WalletActionTypeEnum.KasTransfer:
                return this.walletActionsService.createTransferKasWalletAction(
                    actionData.data.to,
                    this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
                        actionData.data.amount
                    ),
                    this.walletService.getCurrentWallet()!,
                );

            case WalletActionTypeEnum.SignPsktTransaction:
                return this.walletActionsService.createSignPsktAction(
                    actionData.data.psktTransactionJson,
                    actionData.data.submitTransaction,
                    actionData.data.protocol,
                    actionData.data.protocolAction,
                );

        }

        return undefined;
    }

    async sendEtheriumWalletEvent(event: EIP1193ProviderEventEnum) {
        const eventData = await this.ethereumWalletActionsService.getEventData(event);

        await this.sendMessageToConnectedApps({
            type: WalletMessageTypeEnum.EIP1193Event,
            payload: eventData,
        });
    }
}
