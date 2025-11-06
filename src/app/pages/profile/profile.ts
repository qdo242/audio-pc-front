import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ProfileUpdateRequest, ChangePasswordRequest } from '../../interfaces/user';
import { AccountSidebar } from '../../components/account-sidebar/account-sidebar';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AccountSidebar], // THÊM AccountSidebar
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class Profile implements OnInit {
  activeTab: 'profile' | 'password' = 'profile';

  profileData: ProfileUpdateRequest = {
    name: '',
    phone: '',
    address: '',
    avatar: ''
  };

  passwordData: ChangePasswordRequest = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  profileMessage: string = '';
  profileError: string = '';
  passwordMessage: string = '';
  passwordError: string = '';

  isLoadingProfile: boolean = false;
  isLoadingPassword: boolean = false;

  constructor(
    public authService: AuthService,
    private router: Router
  ) {
    // Đọc state từ router (nếu người dùng nhấn "Đổi mật khẩu" từ sidebar)
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state?.['tab'] === 'password') {
      this.activeTab = 'password';
    }
  }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.profileData = {
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
        avatar: user.avatar || ''
      };
    }
  }

  onUpdateProfile(): void {
    this.profileMessage = '';
    this.profileError = '';
    this.isLoadingProfile = true;

    if (!this.profileData.name || !this.profileData.phone || !this.profileData.address) {
      this.profileError = 'Vui lòng điền đầy đủ Tên, SĐT và Địa chỉ.';
      this.isLoadingProfile = false;
      return;
    }

    this.authService.updateProfile(this.profileData).subscribe({
      next: (response) => {
        if (response.success) {
          this.profileMessage = 'Cập nhật hồ sơ thành công!';
        } else {
          this.profileError = response.message || 'Cập nhật thất bại.';
        }
        this.isLoadingProfile = false;
      },
      error: (err) => {
        this.profileError = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
        console.error('Profile update error:', err);
        this.isLoadingProfile = false;
      }
    });
  }

  onChangePassword(): void {
    this.passwordMessage = '';
    this.passwordError = '';
    this.isLoadingPassword = true;

    if (!this.passwordData.currentPassword || !this.passwordData.newPassword || !this.passwordData.confirmPassword) {
      this.passwordError = 'Vui lòng điền đầy đủ các trường.';
      this.isLoadingPassword = false;
      return;
    }
    if (this.passwordData.newPassword.length < 6) {
      this.passwordError = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
      this.isLoadingPassword = false;
      return;
    }
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.passwordError = 'Mật khẩu mới và xác nhận mật khẩu không khớp.';
      this.isLoadingPassword = false;
      return;
    }
    
    this.authService.changePassword(this.passwordData).subscribe({
      next: (response) => {
        if (response.success) {
          this.passwordMessage = 'Đổi mật khẩu thành công!';
          this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
        } else {
          this.passwordError = response.message || 'Đổi mật khẩu thất bại.';
        }
        this.isLoadingPassword = false;
      },
      error: (err) => {
        this.passwordError = 'Lỗi: ' + (err.error?.message || 'Mật khẩu hiện tại không đúng');
        console.error('Password change error:', err);
        this.isLoadingPassword = false;
      }
    });
  }

  // XÓA HÀM LOGOUT (ĐÃ CHUYỂN SANG SIDEBAR)
}