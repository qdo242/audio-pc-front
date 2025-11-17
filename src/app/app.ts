import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './components/header/header';
import { Footer } from './components/footer/footer';
import { ChatWidget } from './components/chat-widget/chat-widget';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, ChatWidget],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('athengaudio-frontend');

  // SỬA: Thêm 2 dòng này
  isChatOpen = false;
  onChatToggled(isOpen: boolean) { this.isChatOpen = isOpen; }
}