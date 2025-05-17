import { Injectable } from "@angular/core";
import { KaspaNetworkActionsService } from "../kaspa-netwrok-services/kaspa-network-actions.service";
import { CommitRevealActionResult, EIP1193RequestResults, KasTransferActionResult, ProtocolType, SignedMessageActionResult, SignPsktTransactionActionResult, WalletActionResult, WalletActionResultType } from "kaspacom-wallet-messages";
import { BaseProtocolClassesService } from "../protocols/base-protocol-classes.service";
import { CompletedActionDisplay } from "../../types/completed-action-display.type";
import { CompoundUtxosActionResult } from "../../types/wallet-action-result";
import { EIP1193RequestType } from "kaspacom-wallet-messages/dist/types/eip1193/requests/request.types";
import { EIP1193ProviderRequestActionResult } from "kaspacom-wallet-messages/dist/types/actions/results/payloads/eip1193-provider-request-action-result.interface";


@Injectable({
    providedIn: 'root',
})
export class CompletedActionOverviewService {
    constructor(private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
        private readonly baseProtocolClassesService: BaseProtocolClassesService,
    ) {
    }

    public getActionDisplay(action: WalletActionResult | undefined): CompletedActionDisplay | undefined {
        if (!action) {
            return undefined
        };

        switch (action?.type) {
            case WalletActionResultType.KasTransfer:
                return this.getTransferKasActionDisplay(action as KasTransferActionResult);
            case WalletActionResultType.CompoundUtxos:
                return this.getCompoundUtxosActionDisplay(action as CompoundUtxosActionResult);
            case WalletActionResultType.CommitReveal:
                return this.getCommitRevealActionDisplay(action as CommitRevealActionResult);
            case WalletActionResultType.SignPsktTransaction:
                return this.getSignPsktTransactionActionDisplay(action as SignPsktTransactionActionResult);
            case WalletActionResultType.MessageSigning:
                return this.getSignMessageActionDisplay(action as SignedMessageActionResult);
            case WalletActionResultType.EIP1193ProviderRequest:
                return this.getEip1193ActionDisplay(action as EIP1193ProviderRequestActionResult<any>);
            default:
                return undefined
        }
    }

    private getTransferKasActionDisplay(actionData: KasTransferActionResult): CompletedActionDisplay {
        return {
            title: "Kas Transfer Details",
            rows: [
                {
                    fieldName: "From",
                    fieldValue: actionData.performedByWallet,
                },
                {
                    fieldName: "To",
                    fieldValue: actionData.to
                },
                {
                    fieldName: "Amount",
                    fieldValue: this.kaspaNetworkActionsService.sompiToNumber(actionData.amount).toString(),
                },
                {
                    fieldName: "Transaction ID",
                    fieldValue: actionData.transactionId
                }
            ]
        }
    }

    private getCompoundUtxosActionDisplay(actionData: CompoundUtxosActionResult): CompletedActionDisplay {
        return {
            title: "Compound UTXOs",
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: actionData.performedByWallet,
                },
                {
                    fieldName: "Transaction ID",
                    fieldValue: actionData.transactionId
                }
            ]
        }
    }

    private getSignMessageActionDisplay(actionData: SignedMessageActionResult): CompletedActionDisplay {
        return {
            title: "Message Signing Details",
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: actionData.performedByWallet,
                },
                {
                    fieldName: "Message",
                    fieldValue: actionData.originalMessage,
                },
                {
                    fieldName: "Encrypted Signed Message",
                    fieldValue: actionData.signedMessage,
                }
            ]
        }
    }

    private getCommitRevealActionDisplay(actionData: CommitRevealActionResult): CompletedActionDisplay {
        let commitRevealData: CompletedActionDisplay | undefined = undefined;
        if (actionData) {
            const reviewerClass = this.baseProtocolClassesService.getClassesFor(actionData.protocol as ProtocolType);

            if (reviewerClass?.completedActionsDataReviewer) {
                commitRevealData = reviewerClass.completedActionsDataReviewer.getActionDisplay(actionData);
            }
        }

        if (!commitRevealData) {
            commitRevealData = {
                title: "Protocol Action Completed",
                rows: [
                    {
                        fieldName: "Wallet",
                        fieldValue: actionData.performedByWallet
                    },
                    {
                        fieldName: "Protocol",
                        fieldValue: actionData.protocol
                    },
                    {
                        fieldName: "Action",
                        fieldValue: actionData.protocolAction
                    },
                ]
            }
        }

        commitRevealData.rows = [
            ...commitRevealData.rows,
            {
                fieldName: "Commit Transaction ID",
                fieldValue: actionData.commitTransactionId
            },
            {
                fieldName: "Reveal Transaction ID",
                fieldValue: actionData.revealTransactionId
            },
        ]

        return commitRevealData;
    }

    private getSignPsktTransactionActionDisplay(actionData: SignPsktTransactionActionResult): CompletedActionDisplay {
        const result = {
            title: `Sign${actionData.transactionId ? ' & Submit' : ''} Pskt Transaction`,
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: actionData.performedByWallet
                },
            ]
        }

        if (actionData.transactionId) {
            result.rows.push({
                fieldName: "Transaction ID",
                fieldValue: actionData.transactionId
            })
        }

        return result;
    }

    private getEip1193ActionDisplay(actionData: EIP1193ProviderRequestActionResult<any>): CompletedActionDisplay | undefined {
        const method = actionData.requestData.method;
        const result = actionData.result.result;

        if (!result || !method) {
            return undefined;
        }

        switch (method) {
            case EIP1193RequestType.SEND_TRANSACTION:
                return this.getSendTransactionActionDisplay(result);
            case EIP1193RequestType.KAS_SEND_TRANSACTION: 
                return this.getKasSendTransactionActionDisplay(result)
            case EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN:
                return this.getAddEthereumChainActionDisplay(result);
            case EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN:
                return this.getSwitchEthereumChainActionDisplay(result);
            case EIP1193RequestType.SIGN_TYPED_DATA:
            case EIP1193RequestType.SIGN_TYPED_DATA_V4:
                return this.getSignTypedDataActionDisplay(result, method);
            default:
                return undefined;
        }
    }

    private getKasSendTransactionActionDisplay(result: EIP1193RequestResults[EIP1193RequestType.KAS_SEND_TRANSACTION]): CompletedActionDisplay {
        return {
            title: "Transaction Sent",
            rows: [
                {
                    fieldName: "Transaction Hash",
                    fieldValue: result.ethTransactionHash
                },
                {
                    fieldName: "Kaspa Transaction",
                    fieldValue: result.kaspatransactionId
                }
            ]
        }
    }

    private getSendTransactionActionDisplay(result: string): CompletedActionDisplay {
        return {
            title: "Transaction Sent",
            rows: [
                {
                    fieldName: "Transaction Hash",
                    fieldValue: result
                },

            ]
        }
    }

    private getAddEthereumChainActionDisplay(result: any): CompletedActionDisplay {
        return {
            title: "Chain Added",
            rows: [
                {
                    fieldName: "Status",
                    fieldValue: result ? "Success" : "Failed"
                }
            ]
        }
    }

    private getSwitchEthereumChainActionDisplay(result: any): CompletedActionDisplay {
        return {
            title: "Chain Switched",
            rows: [
                {
                    fieldName: "Status",
                    fieldValue: result ? "Success" : "Failed"
                }
            ]
        }
    }

    private getSignTypedDataActionDisplay(result: string, method: string): CompletedActionDisplay {
        return {
            title: method === EIP1193RequestType.SIGN_TYPED_DATA ? "Typed Data Signed" : "Typed Data V4 Signed",
            rows: [
                {
                    fieldName: "Signature",
                    fieldValue: result
                }
            ]
        }
    }
}


