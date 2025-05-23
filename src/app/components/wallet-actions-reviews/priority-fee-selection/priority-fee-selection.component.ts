import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  CommonModule,
  JsonPipe,
  NgFor,
  NgIf,
  TitleCasePipe,
} from '@angular/common';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { CompletedActionReview } from '../completed-action-review/completed-action-review.component';
import { WalletAction, WalletActionType } from '../../../types/wallet-action';
import { KaspaNetworkActionsService } from '../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { AppWallet } from '../../../classes/AppWallet';
import { IFeeEstimate } from '../../../../../public/kaspa/kaspa';
import { FormsModule } from '@angular/forms';
import { Krc20OperationDataService } from '../../../services/protocols/krc20/krc20-operation-data.service';

type BucketFeeRate = {
  priorityFee: bigint;
  estimatedSeconds: number;
};

type AvailableOption = 'low' | 'normal' | 'priority' | 'custom';

@Component({
  selector: 'priority-fee-selection',
  standalone: true,
  templateUrl: './priority-fee-selection.component.html',
  styleUrls: ['./priority-fee-selection.component.scss'],
  imports: [
    NgIf,
    NgFor,
    SompiToNumberPipe,
    CompletedActionReview,
    JsonPipe,
    FormsModule,
    TitleCasePipe,
    CommonModule,
  ],
})
export class PriorityFeeSelectionComponent implements OnChanges {
  @Input() action!: WalletAction;
  @Input() wallet!: AppWallet;
  @Output() priorityFeeSelected = new EventEmitter<bigint | undefined>();

  protected totalTransactionsMass: undefined | bigint[] = undefined;
  protected currentFeeRates: undefined | IFeeEstimate = undefined;
  protected transactionMass: undefined | bigint = undefined;
  protected currentOptions:
    | undefined
    | {
      low: BucketFeeRate;
      normal: BucketFeeRate;
      priority: BucketFeeRate;
    } = undefined;

  protected customFee: number = 0;
  protected selectedOption: AvailableOption = 'normal';
  protected additionalPriorityFee: bigint | undefined = undefined;
  protected showPriorityFeeSelection: boolean = false;

  constructor(
    protected kaspaNetworkActionsService: KaspaNetworkActionsService,
    protected krc20OperationsDataService: Krc20OperationDataService,
  ) { }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    this.totalTransactionsMass = undefined;
    this.feeSelected(undefined);
    await this.loadPriorityFeeDataAndEmit(this.action);
  }

  async loadPriorityFeeDataAndEmit(action: WalletAction) {
    await Promise.all([
      this.kaspaNetworkActionsService
        .estimateWalletActionMass(action, this.wallet)
        .then((result) => {
          this.totalTransactionsMass = result;
        }),
      this.kaspaNetworkActionsService.getEstimateFeeRates().then((result) => {
        this.currentFeeRates = result;
      }),
    ]);

    const maxTransactionMass = Math.max(
      ...this.totalTransactionsMass!.map((m) => Number(m))
    );

    this.transactionMass = BigInt(maxTransactionMass);

    this.showPriorityFeeSelection = this.currentFeeRates?.lowBuckets[0].feerate != this.currentFeeRates?.priorityBucket.feerate

    this.currentOptions = {
      low: {
        priorityFee: BigInt(Math.round(
          this.currentFeeRates!.lowBuckets[0].feerate * maxTransactionMass)
        ),

        estimatedSeconds: this.currentFeeRates!.lowBuckets[0].estimatedSeconds,
      },
      normal: {
        priorityFee: BigInt(Math.round(
          this.currentFeeRates!.normalBuckets[0].feerate * maxTransactionMass)
        ),
        estimatedSeconds:
          this.currentFeeRates!.normalBuckets[0].estimatedSeconds,
      },
      priority: {
        priorityFee: BigInt(Math.round(
          this.currentFeeRates!.priorityBucket.feerate * maxTransactionMass)
        ),
        estimatedSeconds: this.currentFeeRates!.priorityBucket.estimatedSeconds,
      },
    };

    this.selectOption(this.selectedOption);
  }

  feeSelected(amount: bigint | undefined) {
    this.additionalPriorityFee =
      amount !== undefined
        ? amount - this.transactionMass! < 0n
          ? 0n
          : amount - this.transactionMass!
        : undefined;
    this.priorityFeeSelected.emit(this.additionalPriorityFee);
  }

  selectOption(option: AvailableOption | string) {
    this.selectedOption = option as AvailableOption;

    if (
      option !== 'custom' &&
      this.currentOptions &&
      option in this.currentOptions
    ) {
      const fee =
        this.currentOptions[option as keyof typeof this.currentOptions]
          .priorityFee;
      this.feeSelected(fee);
    } else if (option == 'custom') {
      this.feeSelected(
        this.kaspaNetworkActionsService.kaspaToSompiFromNumber(this.customFee!)
      );
    }
  }

  getEstimatedTotalFees(): bigint {
    if (
      !this.totalTransactionsMass ||
      this.additionalPriorityFee == undefined
    ) {
      return 0n;
    }

    return (
      this.totalTransactionsMass.reduce((a, b) => a + b, 0n) +
      this.additionalPriorityFee * BigInt(this.totalTransactionsMass.length) +
      this.getAdditionalCommitActionPrice()
    );
  }

  getAdditionalCommitActionPrice(): bigint {
    if (this.action.type == WalletActionType.COMMIT_REVEAL) {
      return this.action.data.options?.revealPriorityFee || 0n;
    }

    return 0n;
  }
}
