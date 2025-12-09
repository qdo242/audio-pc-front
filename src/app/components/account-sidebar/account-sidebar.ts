import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-account-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './account-sidebar.html',
  styleUrls: ['./account-sidebar.scss']
})
export class AccountSidebar {
  @Input() activePage: string = 'profile';

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/']);
    });
  }

  // Hàm điều hướng chung cho các tab
  navigateToTab(tabName: string): void {
    this.router.navigate(['/profile'], { queryParams: { tab: tabName } });
  }
}
