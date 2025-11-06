import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core'; // SỬA: Thêm OnInit
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
// SỬA: Implement OnInit
export class ProductCard implements OnInit {
    @Input() product! : Product;
    
    // SỬA: Tạo một biến mới để chứa URL đã sửa
    displayImage: string = '';

    constructor(
      private cartService : CartService,
      private router : Router,
      private authService: AuthService 
    ){}

    // SỬA: Thêm hàm ngOnInit
    ngOnInit(): void {
      // Khi component được tải, gọi hàm sửa URL
      this.displayImage = this.getSafeDisplayImage();
    }
    
    // SỬA: Thêm hàm helper sửa URL
    getFullImageUrl(url: string | undefined): string {
      const defaultPlaceholder = 'assets/images/default-product.png';
      if (!url || url.trim() === '') {
        return ''; // Trả về rỗng để hàm fallback xử lý
      }
      if (url.startsWith('http')) {
        return url; // Nếu đã là URL đầy đủ
      }
      return `http://localhost:8080${url}`; // Gắn base URL của backend
    }
// SỬA: Logic mới theo yêu cầu (Ưu tiên gallery[0] nếu có)
getSafeDisplayImage(): string {
  const defaultPlaceholder = 'assets/images/default-product.png';
  let imageUrl = '';

  // 1. Ưu tiên ảnh Gallery đầu tiên (theo yêu cầu mới)
  if (this.product.images && this.product.images.length > 0) {
    imageUrl = this.getFullImageUrl(this.product.images[0]);
  }
  
  // 2. Nếu Gallery rỗng, thử lấy Ảnh Bìa
  if (!imageUrl || imageUrl.endsWith('default-product.png')) { 
    imageUrl = this.getFullImageUrl(this.product.image);
  }
  
  // 3. Nếu cả hai đều rỗng, dùng ảnh mặc định
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
      const halfStar = this.product.rating % 1 >= 0.5 ? 1 : 0; // Sửa: boolean -> number
      const emptyStars = 5 - fullStars - halfStar;
      
      return '★'.repeat(fullStars) + '½'.repeat(halfStar) + '☆'.repeat(emptyStars);
    }
}