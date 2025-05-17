import { Component, computed } from '@angular/core';
import { JsonPipe, NgClass, NgFor, NgIf } from '@angular/common';
import {
  WalletAction,
  WalletActionType,
} from '../../../types/wallet-action';
import { WalletService } from '../../../services/wallet.service';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { CompletedActionReview } from '../completed-action-review/completed-action-review.component';
import { KRC20OperationType } from '../../../types/kaspa-network/krc20-operations-data.interface';
import { PriorityFeeSelectionComponent } from '../priority-fee-selection/priority-fee-selection.component';
import { AppWallet } from '../../../classes/AppWallet';
import { ReviewActionDataService } from '../../../services/action-info-services/review-action-data.service';
import { WalletActionService } from '../../../services/wallet-action.service';
import { EIP1193RequestPayload, EIP1193RequestType } from 'kaspacom-wallet-messages';

const TIMEOUT = 2 * 60 * 1000;

@Component({
  selector: 'review-action',
  standalone: true,
  templateUrl: './review-action.component.html',
  styleUrls: ['./review-action.component.scss'],
  imports: [NgIf, NgFor, NgClass, SompiToNumberPipe, CompletedActionReview, JsonPipe, PriorityFeeSelectionComponent],
})
export class ReviewActionComponent {
  public WalletActionType = WalletActionType;
  public KRC20OperationType = KRC20OperationType;
  public Number = Number;

  currentActionDisplay = computed(() => this.currentActionSignal ? this.reviewActionDataService.getActionDisplay(this.currentActionSignal()?.action, this.wallet) : undefined);
  currentActionSignal = computed(() => this.walletActionService.getActionToApproveSignal()());
  currentProgressSignal = computed(() => this.walletActionService.getCurrentProgressSignal()());
  actionResultSignal = computed(() =>this.walletActionService.getActionResultSignal()() );


  private resolve:
    | ((result: { isApproved: boolean; priorityFee?: bigint }) => void)
    | undefined = undefined;

  private timeout: NodeJS.Timeout | undefined = undefined;

  // Result
  protected currentPriorityFee: bigint | undefined = undefined;

  constructor(private walletService: WalletService, private walletActionService: WalletActionService, private readonly reviewActionDataService: ReviewActionDataService) { }

  requestUserConfirmation(action: WalletAction): Promise<{
    isApproved: boolean;
  }> {
    if (this.resolve) {
      this.resolveActionAndClear(false);
    }

    return this.initAction(action);
  }



  // COMPONENT MANAGEMENT
  private clearData() {
    clearTimeout(this.timeout!);
    this.resolve = undefined;
    this.timeout = undefined;
  }

  private resolveActionAndClear(isApproved: boolean, priorityFee?: bigint) {
    this.walletActionService.resolveCurrentWaitingForApproveAction(isApproved, priorityFee);
    this.clearData();
  }

  private initAction(action: WalletAction): Promise<{
    isApproved: boolean;
    priorityFee?: bigint;
  }> {
    this.timeout = setTimeout(() => {
      this.resolveActionAndClear(false);
    }, TIMEOUT);

    return new Promise<{
      isApproved: boolean;
      priorityFee?: bigint;
    }>((res) => {
      this.resolve = res;
    });
  }

  protected acceptTransaction() {
    if (!this.isAvailableForApproval()) {
      return;
    }

    this.resolveActionAndClear(true, this.currentPriorityFee!);
  }

  protected rejectTransaction() {
    this.resolveActionAndClear(false);
  }

  setCurrentPriorityFee(priorityFee: bigint | undefined) {
    this.currentPriorityFee = priorityFee;
  }

  protected get walletAddress(): string {
    return this.walletService.getCurrentWallet()?.getAddress() || '';
  }

  protected get wallet(): AppWallet {
    return this.walletService.getCurrentWallet()!;
  }

  isAvailableForApproval(): boolean {
    return this.currentPriorityFee !== undefined || !this.isActionHasPriorityFee;
  }

  protected get isActionHasPriorityFee() {
    if (!(this.currentActionSignal && this.currentActionSignal())) {
      return false;
    }

    if (this.currentActionSignal()!.action.type === WalletActionType.SIGN_MESSAGE) {
      return false;
    }

    if (this.currentActionSignal()!.action.type === WalletActionType.EIP1193_PROVIDER_REQUEST) {
      const actionData = this.currentActionSignal()!.action.data as EIP1193RequestPayload<EIP1193RequestType>;

      if (actionData.method != EIP1193RequestType.KAS_SEND_TRANSACTION) {
        return false;
      }
    }

    return true;
  }
}
