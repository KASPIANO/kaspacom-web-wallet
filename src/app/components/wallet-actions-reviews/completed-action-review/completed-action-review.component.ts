import { Component, computed, inject, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { WalletActionResult } from 'kaspacom-wallet-messages';
import { CompletedActionOverviewService } from '../../../services/action-info-services/completed-action-overview.service';

@Component({
  selector: 'completed-action-review',
  standalone: true,
  templateUrl: './completed-action-review.component.html',
  styleUrls: ['./completed-action-review.component.scss'],
  imports: [NgIf, NgFor, SompiToNumberPipe],
})
export class CompletedActionReview {
  completedActionOverviewService = inject(CompletedActionOverviewService);

  currentActionDisplay = computed(() => this.completedActionOverviewService.getActionDisplay(this.actionResult));

  @Input() actionResult!: WalletActionResult;
}
