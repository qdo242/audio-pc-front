import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss']
})
export class ForgotPassword {
  email: string = '';
  otpCode: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  
  currentStep: number = 1; // 1: Nhập email, 2: Nhập OTP + mật khẩu
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  // Bước 1: Gửi OTP
  sendOTP(): void {
    if (!this.email) {
      this.errorMessage = 'Vui lòng nhập email';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.forgotPassword(this.email).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.successMessage = response.message || 'Mã OTP đã được gửi đến email của bạn!';
          this.currentStep = 2; // Chuyển sang bước 2
        } else {
          this.errorMessage = response.message || 'Có lỗi xảy ra khi gửi mã OTP';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
        console.error('Send OTP error:', error);
      }
    });
  }

  // Bước 2: Đặt lại mật khẩu
  resetPassword(): void {
    if (!this.otpCode || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Vui lòng nhập đầy đủ thông tin';
      return;
    }

    if (this.otpCode.length !== 6) {
      this.errorMessage = 'Mã OTP phải có 6 số';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'Mật khẩu phải có ít nhất 6 ký tự';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Mật khẩu xác nhận không khớp';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    console.log('🔍 Sending reset password request:', {
      email: this.email,
      otpCode: this.otpCode,
      newPassword: this.newPassword
    });

    this.authService.resetPassword(this.email, this.otpCode, this.newPassword).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('✅ Reset password response:', response);
        
        if (response.success) {
          this.successMessage = response.message || 'Đặt lại mật khẩu thành công!';
          
          // Tự động chuyển hướng sau 3 giây
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        } else {
          this.errorMessage = response.message || 'Không thể đặt lại mật khẩu';
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('❌ Reset password error:', error);
        
        if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
        }
      }
    });
  }

  // Gửi lại OTP
  resendOTP(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.forgotPassword(this.email).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.successMessage = 'Mã OTP mới đã được gửi đến email của bạn!';
        } else {
          this.errorMessage = response.message || 'Có lỗi xảy ra khi gửi mã OTP';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
      }
    });
  }

  // Quay lại bước 1
  backToStep1(): void {
    this.currentStep = 1;
    this.otpCode = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.errorMessage = '';
    this.successMessage = '';
  }
}