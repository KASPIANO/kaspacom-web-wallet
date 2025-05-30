import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WalletService } from '../../../services/wallet.service';
import { UtilsHelper } from '../../../services/utils.service';
import { DEFAULT_DERIVED_PATH } from '../../../config/consts';
import { MnemonicWordsComponent } from '../../shared/mnemonic-words/mnemonic-words.component';
import { VerifyMnemonicComponent } from '../verify-mnemonic/verify-mnemonic.component';

@Component({
  selector: 'create-wallet',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MnemonicWordsComponent,
    VerifyMnemonicComponent
  ],
  templateUrl: './create-wallet.component.html',
  styleUrls: ['./create-wallet.component.scss']
})
export class CreateWalletComponent implements OnInit {
  mnemonicLength: number = 12;
  mnemonic: string = '';
  password: string = '';
  creationError: string = '';
  hasSavedMnemonic: boolean = false;
  showVerification: boolean = false;

  constructor(
    private walletService: WalletService,
    private router: Router,
    private utils: UtilsHelper
  ) {}

  ngOnInit(): void {
    this.refreshMnemonic();
  }

  refreshMnemonic() {
    this.mnemonic = this.walletService.generateMnemonic(this.mnemonicLength);
    this.creationError = ''; // Clear any previous errors
    this.hasSavedMnemonic = false;
    this.showVerification = false;
  }

  getWalletAddress(): string {
    const address = this.walletService.getWalletAddressFromMnemonic(
      this.mnemonic,
      this.password
    );
    return address || ''; // Return empty string if address is null
  }

  proceedToVerification() {
    if (!this.hasSavedMnemonic) {
      this.creationError = 'Please confirm that you have saved your mnemonic phrase';
      return;
    }
    this.showVerification = true;
  }

  onVerificationBack() {
    this.showVerification = false;
  }

  async onVerificationComplete() {
    await this.createWallet();
  }

  private async createWallet() {
    this.creationError = ''; // Clear any previous errors
    let walletAdditionResult: { sucess: boolean; error?: string } | null = null;

    try {
      const walletCount = await this.walletService.getWalletsCount();

      walletAdditionResult = await this.walletService.addWalletFromMemonic(
        'Saved Wallet ' + walletCount,
        this.mnemonic.trim(),
        DEFAULT_DERIVED_PATH,
        '#' + this.walletService.getWalletAccountNumberFromDerivedPath(DEFAULT_DERIVED_PATH),
        this.utils.isNullOrEmptyString(this.password) ? undefined : this.password
      );

      if (walletAdditionResult?.sucess) {
        this.router.navigate(['/wallet-selection']);
      } else {
        this.creationError = walletAdditionResult?.error || 'Failed to create wallet.';
      }
    } catch (error) {
      console.error('Error creating wallet:', error);
      this.creationError = 'Error creating wallet. Please try again.';
    }
  }
}
