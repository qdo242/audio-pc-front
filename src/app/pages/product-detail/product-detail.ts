import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Product } from '../../interfaces/product';
import { ProductService } from '../../services/product';
import { AuthService } from '../../services/auth';
import { CartService } from '../../services/cart';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ProductCard],
  templateUrl: './product-detail.html',
  styleUrls: ['./product-detail.scss']
})
export class ProductDetail implements OnInit {
  product: Product | undefined;
  selectedImage: string = ''; 
  quantity: number = 1;
  relatedProducts: Product[] = [];
  isLoading: boolean = true;
  activeTab: string = 'description';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    public authService: AuthService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0); 
    
    this.route.params.subscribe(params => {
      const productId = params['id'];
      if (productId) {
        this.loadProduct(productId);
      }
    });
  }

  // SỬA: THÊM HÀM HELPER NÀY (Fix ảnh vỡ ở trang chi tiết)
  getFullImageUrl(url: string | undefined): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    if (!url || url.trim() === '') {
      return ''; // Sẽ được hàm fallback xử lý
    }
    if (url.startsWith('http')) {
      return url;
    }
    return `http://localhost:8080${url}`; 
  }

  // SỬA: Logic thông minh để chọn ảnh (Ưu tiên ảnh bìa)
  getSafeDisplayImage(product: Product, type: 'cover' | 'gallery'): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    
    // 1. Lấy ảnh bìa
    let coverImage = this.getFullImageUrl(product.image);
    
    // 2. Lấy ảnh gallery (nếu có)
    let galleryImages = (product.images && product.images.length > 0)
                          ? product.images.map(img => this.getFullImageUrl(img))
                          : [];
                          
    if (type === 'cover') {
      if (coverImage && coverImage !== defaultPlaceholder) {
        return coverImage;
      }
      if (galleryImages.length > 0 && galleryImages[0] !== defaultPlaceholder) {
        return galleryImages[0]; // Fallback: Lấy ảnh gallery đầu tiên
      }
    }
    
    // Fallback cho gallery
    if (type === 'gallery') {
      if (galleryImages.length > 0) {
        return galleryImages[0]; // Trả về ảnh gallery đầu tiên
      }
      if (coverImage && coverImage !== defaultPlaceholder) {
        return coverImage; // Fallback: Lấy ảnh bìa
      }
    }
    
    return defaultPlaceholder; // Fallback cuối cùng
  }


  loadProduct(productId: string): void {
    this.isLoading = true;
    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        // SỬA: Sửa URL cho cả ảnh bìa và gallery
        const coverImage = this.getSafeDisplayImage(product, 'cover');
        const galleryImages = (product.images && product.images.length > 0) 
                              ? product.images.map(img => this.getFullImageUrl(img)) 
                              : [coverImage];

        this.product = {
          ...product,
          image: coverImage, 
          images: galleryImages, 
          rating: product.rating || 0,
          reviewCount: product.reviewCount || 0,
          features: product.features || [],
        };
        
        // SỬA: Hiển thị ảnh bìa (product.image) làm ảnh chính
        this.selectedImage = this.product.image; 
        
        this.loadRelatedProducts(this.product);
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading product:', error);
        this.isLoading = false;
      }
    });
  }

  loadRelatedProducts(product: Product): void {
    this.productService.getProductsByCategory(product.category).subscribe({
      next: (products) => {
        this.relatedProducts = products
          .filter(p => p.id !== product.id)
          .slice(0, 4)
          .map(p => ({
            ...p,
            image: this.getSafeDisplayImage(p, 'cover'), // Sửa logic ảnh
          }));
      },
      error: (error: any) => {
        console.error('Error loading related products:', error);
      }
    });
  }

  changeImage(image: string): void {
    this.selectedImage = image;
  }

  increaseQuantity(): void {
    if (this.product && this.quantity < this.product.stock) {
      this.quantity++;
    } else {
      alert('Đã đạt số lượng tối đa trong kho!');
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart(): void {
    if (this.product) {
      const userId = this.authService.currentUserValue?.id?.toString() || 'user123';
      this.cartService.addToCartFrontend(this.product, this.quantity, userId).subscribe({
        next: () => {
          alert(`Đã thêm ${this.quantity} ${this.product?.name} vào giỏ hàng!`);
        },
        error: (error: any) => {
          console.error('Error adding to cart:', error);
          alert('❌ Có lỗi xảy ra khi thêm vào giỏ hàng!');
        }
      });
    }
  }

  buyNow(): void {
    if (this.product) {
      const userId = this.authService.currentUserValue?.id?.toString() || 'user123';
      this.cartService.addToCartFrontend(this.product, this.quantity, userId).subscribe({
        next: () => {
          this.router.navigate(['/checkout']); 
        },
        error: (error: any) => {
          console.error('Error adding to cart:', error);
          alert('❌ Có lỗi xảy ra! Vui lòng thử lại.');
        }
      });
    }
  }

  addToWishlist(): void {
    if (this.product && this.product.id) {
      if (this.authService.isLoggedIn) {
        this.authService.addToWishlist(String(this.product.id)).subscribe({
          next: (response: any) => {
            if (response.success) alert('❤️ ' + response.message);
            else alert('ℹ️ ' + response.message);
          },
          error: (error: any) => alert('❌ Có lỗi xảy ra khi thêm vào wishlist!')
        });
      } else {
        alert('🔐 Vui lòng đăng nhập để thêm vào danh sách yêu thích!');
        this.router.navigate(['/login']);
      }
    }
  }

  isInWishlist(): boolean {
    if (!this.authService.currentUserValue || !this.product?.id) {
      return false;
    }
    return this.authService.currentUserValue.wishlist?.includes((this.product.id)) || false;
  }

  getDiscountPercent(): number {
    if (this.product?.originalPrice && this.product.originalPrice > this.product.price) {
      return Math.round(((this.product.originalPrice - this.product.price) / this.product.originalPrice) * 100);
    }
    return 0;
  }

  getDiscount(): number {
    return this.getDiscountPercent();
  }
  
  // SỬA LỖI (TS2345): Chuyển 'halfStar' từ boolean thành number
  getStarRating(rating: number): string {
    const fullStars = Math.floor(rating);
    // SỬA: Chuyển 'halfStar' thành 1 (nếu true) hoặc 0 (nếu false)
    const halfStar = rating % 1 >= 0.5 ? 1 : 0; 
    const emptyStars = 5 - fullStars - halfStar;
    
    // Giờ 'halfStar' là number (0 hoặc 1) nên .repeat() sẽ hoạt động
    return '★'.repeat(fullStars) + '½'.repeat(halfStar) + '☆'.repeat(emptyStars);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  formatArray(items: string[] | undefined): string {
    if (!items || items.length === 0) return '';
    return items.join(', ');
  }

  hasSpec(spec: any): boolean {
    return spec !== undefined && spec !== null && spec !== '';
  }

  showAdminNotice(): boolean {
    return this.authService.isAdminSync();
  }
}