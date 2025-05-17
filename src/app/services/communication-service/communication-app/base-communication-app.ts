import { WalletMessageInterface } from "kaspacom-wallet-messages";

export abstract class BaseCommunicationApp {
    abstract sendMessage(message: WalletMessageInterface): Promise<void>;
    abstract setOnMessageEventHandler(handler: (message: WalletMessageInterface) => void): Promise<void>;
    abstract disconnect(): void;
    abstract getUrl(): string;
}
