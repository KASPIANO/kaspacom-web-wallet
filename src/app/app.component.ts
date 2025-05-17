import { AfterViewInit, Component, Inject, OnInit, Renderer2 } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PasswordManagerService } from './services/password-manager.service';
import { AppHeaderComponent } from './components/app-header/app-header.component';
import { KaspaNetworkActionsService } from './services/kaspa-netwrok-services/kaspa-network-actions.service';
import {  NgIf } from '@angular/common';
import { environment } from '../environments/environment';
import { IFrameCommunicationApp } from './services/communication-service/communication-app/iframe-communication.service';
import { CommunicationManagerService } from './services/communication-service/communication-manager.service';
import { ethers } from 'ethers';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [KaspaNetworkActionsService]
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'kaspiano-wallet';


  constructor(
    private readonly router: Router,
    private readonly passwordManagerService: PasswordManagerService,
    private readonly communicationManagerService: CommunicationManagerService,
    private renderer: Renderer2) {
  }

  async ngOnInit() {
    if (!this.isAllowedDomain()) {
      return;
    }

    if (IFrameCommunicationApp.isIframe()) {
      this.communicationManagerService.addApp(new IFrameCommunicationApp());
    }

    if (this.passwordManagerService.isUserHasSavedPassword()) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/set-password']);
    }
  }

  ngAfterViewInit(): void {
    let loader = this.renderer.selectRootElement('#application-loader-startup');
    if (loader.style.display != "none") loader.style.display = "none"; //hide loader
    loader.remove();
  }

  isAllowedDomain(): boolean {
    return environment.allowedDomains.includes(window.location.hostname);
  }

  incompatibleBrowserReason(): string | undefined {
    if (!(window.crypto && window.crypto?.subtle)) {
      return 'Crypto not supported';
    }

    return undefined;
  }

}
