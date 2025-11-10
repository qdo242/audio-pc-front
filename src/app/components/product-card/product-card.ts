import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core'; 
import { Router, RouterModule } from '@angular/router';
import { Product } from '../../interfaces/product';
import { CartService } from '../../services/cart';
import { AuthService } from '../../services/auth'; 

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard implements OnInit {
    @Input() product! : Product;
    @Output() wishlistChanged = new EventEmitter<void>();
    
    displayImage: string = '';

    constructor(
      private cartService : CartService,
      private router : Router,
      public authService: AuthService
    ){}

    ngOnInit(): void {
      this.displayImage = this.getSafeDisplayImage();
    }
    
    getFullImageUrl(url: string | undefined): string {
      const defaultPlaceholder = 'assets/images/default-product.png';
      if (!url || url.trim() === '') {
        return ''; 
      }
      if (url.startsWith('http')) {
        return url; 
      }
      return `http://localhost:8080${url}`; 
    }

    // SỬA: Đảo ngược logic. Ưu tiên product.image (Ảnh Bìa) trước
    getSafeDisplayImage(): string {
      const defaultPlaceholder = 'assets/images/default-product.png';
      let imageUrl = '';

      // 1. Ưu tiên Ảnh Bìa (product.image)
      imageUrl = this.getFullImageUrl(this.product.image);
      
      // 2. Nếu không có Ảnh Bìa, thử lấy ảnh Gallery đầu tiên (product.images[0])
      if (!imageUrl || imageUrl.endsWith('default-product.png')) { 
        if (this.product.images && this.product.images.length > 0) {
          // (Backend mới đã tách video, nên images[0] luôn là ảnh)
          imageUrl = this.getFullImageUrl(this.product.images[0]);
        }
      }
      
      return imageUrl || defaultPlaceholder;
    }

    getDiscount(): number {
      if (this.product.originalPrice && this.product.originalPrice > this.product.price) {
        return Math.round((1 - this.product.price / this.product.originalPrice) * 100);
      }
      return 0;
    }

    viewDetail(): void {
      this.router.navigate(['/products', this.product.id]);
    }

    addToCart(event: Event): void {
      event.stopPropagation();
      const userId = this.authService.currentUserValue?.id?.toString() || 'user123';
      
      this.cartService.addToCartFrontend(this.product, 1, userId).subscribe({
        next: () => {
          alert('Đã thêm vào giỏ hàng!');
        },
        error: (err) => {
          console.error('Failed to add to cart', err);
          alert('Lỗi: Không thể thêm vào giỏ hàng');
        }
      });
    }

    getStarRating(): string {
      const fullStars = Math.floor(this.product.rating);
      const halfStar = this.product.rating % 1 >= 0.5 ? 1 : 0; 
      const emptyStars = 5 - fullStars - halfStar;
      
      return '★'.repeat(fullStars) + '½'.repeat(halfStar) + '☆'.repeat(emptyStars);
    }

    isInWishlist(): boolean {
      if (!this.authService.currentUserValue || !this.authService.currentUserValue.wishlist) {
        return false;
      }
      return this.authService.currentUserValue.wishlist.includes(this.product.id);
    }

    toggleWishlist(event: Event): void {
      event.stopPropagation(); 

      if (!this.authService.isLoggedIn) {
        alert('Vui lòng đăng nhập để sử dụng tính năng này!');
        this.router.navigate(['/login']);
        return;
      }

      if (this.isInWishlist()) {
        this.authService.removeFromWishlist(this.product.id).subscribe({
          next: () => {
            console.log('Đã xóa khỏi wishlist');
            this.wishlistChanged.emit(); 
          },
          error: (err) => console.error('Lỗi khi xóa wishlist:', err)
        });
      } else {
        this.authService.addToWishlist(this.product.id).subscribe({
          next: () => {
            console.log('Đã thêm vào wishlist');
            this.wishlistChanged.emit();
          },
          error: (err) => console.error('Lỗi khi thêm wishlist:', err)
        });
      }
    }
}