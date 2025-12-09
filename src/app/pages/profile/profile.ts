import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { AuthService } from '../../services/auth';
import { ProductService } from '../../services/product'; // THÊM
import { ProfileUpdateRequest, ChangePasswordRequest } from '../../interfaces/user';
import { AccountSidebar } from '../../components/account-sidebar/account-sidebar';
import { ProductCard } from '../../components/product-card/product-card'; // THÊM
import { Product } from '../../interfaces/product'; // THÊM

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AccountSidebar, ProductCard], // THÊM ProductCard
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class Profile implements OnInit {
  // Thêm 'wishlist' vào kiểu activeTab
  activeTab: 'profile' | 'password' | 'wishlist' = 'profile';

  // Dữ liệu cho Profile & Password (GIỮ NGUYÊN)
  profileData: ProfileUpdateRequest = { name: '', phone: '', address: '', avatar: '' };
  passwordData: ChangePasswordRequest = { currentPassword: '', newPassword: '', confirmPassword: '' };
  profileMessage = ''; profileError = ''; passwordMessage = ''; passwordError = '';
  isLoadingProfile = false; isLoadingPassword = false;

  // Dữ liệu cho Wishlist (MỚI)
  wishlistProducts: Product[] = [];
  isLoadingWishlist: boolean = false;

  constructor(
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private productService: ProductService // Inject ProductService
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();

    // Lắng nghe URL để chuyển tab
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (tab === 'password') {
        this.activeTab = 'password';
      } else if (tab === 'wishlist') {
        this.activeTab = 'wishlist';
        this.loadWishlist(); // Tải dữ liệu khi vào tab wishlist
      } else {
        this.activeTab = 'profile';
      }
    });
  }

  // --- LOGIC MỚI: TẢI WISHLIST ---
  loadWishlist(): void {
    this.isLoadingWishlist = true;
    this.authService.getWishlist().pipe(
      switchMap(response => {
        if (response.success && response.wishlist.length > 0) {
          const productObservables = response.wishlist.map(id => this.productService.getProductById(id));
          return forkJoin(productObservables);
        } else {
          return of([]);
        }
      })
    ).subscribe({
      next: (products) => {
        this.wishlistProducts = products.filter(p => p !== null) as Product[];
        this.isLoadingWishlist = false;
      },
      error: (error) => {
        console.error('Error loading wishlist:', error);
        this.isLoadingWishlist = false;
      }
    });
  }

  // Sự kiện xóa sản phẩm khỏi wishlist (reload lại list)
  onWishlistChanged(): void {
    this.loadWishlist();
  }

  // ... (GIỮ NGUYÊN CÁC HÀM loadUserProfile, onUpdateProfile, onChangePassword CŨ) ...
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
     // ... (Code cũ của bạn giữ nguyên)
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
    // ... (Code cũ của bạn giữ nguyên)
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
}
