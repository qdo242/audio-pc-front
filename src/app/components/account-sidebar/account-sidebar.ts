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
  // Input này sẽ nhận giá trị 'profile', 'orders', 'wishlist', 'password'
  @Input() activePage: string = 'profile'; 

  constructor(
    public authService: AuthService, // Public để HTML dùng
    private router: Router
  ) {}

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/']);
    });
  }

  // Chuyển hướng đến trang profile và đặt tab
  navigateToPasswordTab(): void {
    // Điều hướng đến /profile và truyền một state
    // (ProfileComponent sẽ cần được cập nhật để đọc state này, 
    // nhưng hiện tại nó sẽ chỉ điều hướng)
    this.router.navigate(['/profile'], { state: { tab: 'password' } });
  }
}