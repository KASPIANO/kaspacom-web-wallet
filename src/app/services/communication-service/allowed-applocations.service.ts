import { Injectable } from "@angular/core";
import { LOCAL_STORAGE_KEYS } from "../../config/consts";


@Injectable({
    providedIn: 'root',
  })
  export class allowedAppLocationsService {
    private allowedAppLocations: {[appUrl: string]: string};

    constructor() {
        const allowedApplications = localStorage.getItem(LOCAL_STORAGE_KEYS.ALLOWED_APPLICATIONS);
        if (allowedApplications) {
            this.allowedAppLocations = JSON.parse(allowedApplications);
        } else {
            this.allowedAppLocations = {};
        }
    }

    isAllowedApplication(appUrl: string, currentWalletIdWithAccount: string) {
        return this.allowedAppLocations[appUrl] === currentWalletIdWithAccount;
    }

    addAllowedApplication(appUrl: string, currentWalletIdWithAccount: string) {
        this.allowedAppLocations[appUrl] = currentWalletIdWithAccount;
        localStorage.setItem(LOCAL_STORAGE_KEYS.ALLOWED_APPLICATIONS, JSON.stringify(this.allowedAppLocations));
    }

    removeAllowedApplication(appUrl: string) {
        delete this.allowedAppLocations[appUrl];
        localStorage.setItem(LOCAL_STORAGE_KEYS.ALLOWED_APPLICATIONS, JSON.stringify(this.allowedAppLocations));
    }
  }
  