import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  userData = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  };

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    // Validation
    if (!this.userData.name || !this.userData.email || !this.userData.password) {
      this.errorMessage = 'Vui lòng điền đầy đủ thông tin';
      return;
    }

    if (this.userData.password !== this.userData.confirmPassword) {
      this.errorMessage = 'Mật khẩu xác nhận không khớp';
      return;
    }

    if (this.userData.password.length < 6) {
      this.errorMessage = 'Mật khẩu phải có ít nhất 6 ký tự';
      return;
    }

    if (!this.userData.agreeToTerms) {
      this.errorMessage = 'Vui lòng đồng ý với điều khoản sử dụng';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(this.userData).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.successMessage = 'Đăng ký thành công! Đang chuyển hướng...';
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 2000);
        } else {
          this.errorMessage = response.message || 'Đăng ký thất bại';
        }
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 400) {
          this.errorMessage = error.error?.message || 'Email đã được sử dụng';
        } else {
          this.errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
        }
        console.error('Register error:', error);
      }
    });
  }
}