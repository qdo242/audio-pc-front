import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { Product, Review } from '../../interfaces/product';
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
  selectedImage: string = ''; // Đây là media (ảnh/video) đang được hiển thị
  quantity: number = 1;
  relatedProducts: Product[] = [];
  isLoading: boolean = true;
  activeTab: string = 'description';

  // Biến quản lý media
  videoUrl: string | null = null;
  // coverImage: string | null = null; // SỬA: Không cần, dùng product.image
  galleryImages: string[] = []; // Chỉ chứa ảnh (không chứa video)
  defaultPlaceholder = 'assets/images/default-product.png';

  isSubmittingReview = false;
  newReview: Review = {
    author: 'Khách hàng',
    rating: 0,
    comment: ''
  };

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

  // SỬA: Hàm getFullImageUrl giờ chấp nhận cả 'null'
  getFullImageUrl(url: string | undefined | null): string {
    if (!url || url.trim() === '') {
      return ''; 
    }
    if (url.startsWith('http')) {
      return url; 
    }
    return `http://localhost:8080${url}`; 
  }


  loadProduct(productId: string): void {
    this.isLoading = true;
    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        
        // SỬA: LOGIC TÁCH MEDIA (Dùng model backend mới)
        this.product = product;
        
        // 1. Tách Video (Fix lỗi TS2345 bằng cách kiểm tra null trước)
        this.videoUrl = product.videoUrl ? this.getFullImageUrl(product.videoUrl) : null;

        // 2. Tách Gallery (product.images)
        this.galleryImages = (product.images || []).map(img => this.getFullImageUrl(img));

        // 3. Lấy Ảnh Bìa (product.image)
        const coverImage = this.getFullImageUrl(product.image);

        // 4. SỬA: Set media hiển thị mặc định (Ưu tiên Ảnh Bìa > Ảnh Gallery đầu tiên > Video)
        this.selectedImage = coverImage || this.galleryImages[0] || this.videoUrl || this.defaultPlaceholder;

        // Cập nhật lại product (để đảm bảo rating/review không null)
        this.product = {
          ...product,
          rating: product.rating || 0,
          reviewCount: product.reviewCount || 0,
          features: product.features || [],
        };
        
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
            // Sửa: Lấy ảnh bìa hoặc gallery đầu tiên
            image: this.getFullImageUrl(p.image) || this.getFullImageUrl(p.images?.[0]) || this.defaultPlaceholder
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
      
      // Gửi ảnh bìa (product.image)
      const productForCart = {
        ...this.product,
        image: this.product.image || this.galleryImages[0] || this.defaultPlaceholder
      };

      this.cartService.addToCartFrontend(productForCart, this.quantity, userId).subscribe({
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

      const productForCart = {
        ...this.product,
        image: this.product.image || this.galleryImages[0] || this.defaultPlaceholder
      };

      this.cartService.addToCartFrontend(productForCart, this.quantity, userId).subscribe({
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

  // THÊM HÀM KIỂM TRA MEDIA TYPE
  isMediaVideo(url: string): boolean {
    // Sửa: Phải kiểm tra 'videoUrl' vì 'selectedImage' có thể là ảnh
    if (!this.videoUrl) return false;
    // Chỉ là video NẾU url đang chọn LÀ url video
    return url === this.videoUrl;
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
  
  getStarRating(rating: number): string {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0; 
    const emptyStars = 5 - fullStars - halfStar;
    
    return '★'.repeat(fullStars) + '½'.repeat(halfStar) + '☆'.repeat(emptyStars);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
  onSubmitReview(reviewForm: NgForm): void {
    if (reviewForm.invalid) {
      alert('Vui lòng chọn số sao và viết bình luận.');
      return;
    }
    
    if (!this.product) return;

    if (!this.authService.isLoggedIn) {
      alert('Vui lòng đăng nhập để gửi đánh giá!');
      this.router.navigate(['/login']);
      return;
    }

    this.isSubmittingReview = true;
    this.newReview.author = this.authService.userName || 'Khách hàng';

    this.productService.addReview(this.product.id, this.newReview).subscribe({
      next: (updatedProduct) => {
        // Cập nhật sản phẩm với review mới
        this.product = updatedProduct; 
        alert('Cảm ơn đánh giá của bạn!');
        
        // Reset form
        this.newReview.rating = 5;
        this.newReview.comment = '';
        reviewForm.resetForm(this.newReview); 

        this.isSubmittingReview = false;
      },
      error: (err) => {
        console.error('Lỗi khi gửi review:', err);
        alert('Gửi đánh giá thất bại. Vui lòng thử lại.');
        this.isSubmittingReview = false;
      }
    });
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