import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { Product } from '../../interfaces/product';
import { ProductService } from '../../services/product';
import { AuthService } from '../../services/auth';
import { CartService } from '../../services/cart';
import { ProductCard } from '../../components/product-card/product-card';

interface Review {
  author: string;
  rating: number;
  comment: string;
  createdAt?: string;
}

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

  selectedVariant: string | null = null;
  variantImageMap: { [key: string]: string[] } = {};
  filteredGalleryImages: string[] = [];

  videoUrl: string | null = null;
  defaultPlaceholder = 'assets/images/default-product.png';

  isSubmittingReview = false;
  newReview: Review = { author: 'Khách hàng', rating: 0, comment: '' };

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

  getFullImageUrl(url: string | undefined | null): string {
    if (!url || url.trim() === '') return '';
    if (url.startsWith('http')) return url;
    return `http://localhost:8080${url}`;
  }

  isHex(str: string): boolean {
      return /^#([0-9A-F]{3}){1,2}$/i.test(str);
  }

  private normalizeKey(key: string): string {
      return key ? key.trim().toLowerCase() : '';
  }

  createVariantMap(product: Product): { [key: string]: string[] } {
    const map: { [key: string]: string[] } = {};
    const colors = product.colors || [];
    colors.forEach(c => { map[this.normalizeKey(c)] = []; });

    const allImages = product.images || [];
    const unassignedImages: string[] = [];

    allImages.forEach(imgUrl => {
        const parts = imgUrl.split('?color=');
        const rawUrl = parts[0];
        const colorTag = parts.length > 1 ? decodeURIComponent(parts[1]) : null;
        const fullUrl = this.getFullImageUrl(rawUrl);

        if (colorTag) {
            const normalizedTag = this.normalizeKey(colorTag);
            if (map.hasOwnProperty(normalizedTag)) {
                map[normalizedTag].push(fullUrl);
            } else {
                unassignedImages.push(fullUrl);
            }
        } else {
            unassignedImages.push(fullUrl);
        }
    });

    if (unassignedImages.length > 0) {
        if (colors.length > 0) {
             const firstColorKey = this.normalizeKey(colors[0]);
             if (map[firstColorKey].length === 0) {
                 map[firstColorKey].push(...unassignedImages);
             }
        } else {
             map['default'] = unassignedImages;
        }
    }
    return map;
  }

  loadProduct(productId: string): void {
    this.isLoading = true;
    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        this.product = product;
        this.videoUrl = product.videoUrl ? this.getFullImageUrl(product.videoUrl) : null;
        this.variantImageMap = this.createVariantMap(product);

        this.showAllImages();

        this.product = {
          ...product,
          rating: product.rating || 0,
          reviewCount: product.reviewCount || 0,
          features: product.features || [],
          supportPhone: (product as any).supportPhone || '1900 1234',
          returnPolicyDays: (product as any).returnPolicyDays || 30,
        } as Product;

        if (this.product.stock <= 0) {
            this.quantity = 0;
        } else {
            this.quantity = 1;
        }

        this.loadRelatedProducts(this.product);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading product:', error);
        this.isLoading = false;
      }
    });
  }

  selectVariant(variantName: string | null): void {
      if (this.selectedVariant === variantName && variantName !== null) {
          this.showAllImages();
          return;
      }

      this.selectedVariant = variantName;
      this.filteredGalleryImages = [];

      if (this.videoUrl) {
          this.filteredGalleryImages.push(this.videoUrl);
      }

      if (variantName) {
          const normalizedKey = this.normalizeKey(variantName);
          let imagesForVariant = this.variantImageMap[normalizedKey];

          if (!imagesForVariant && this.variantImageMap[variantName]) {
              imagesForVariant = this.variantImageMap[variantName];
          }

          if (imagesForVariant && imagesForVariant.length > 0) {
              this.filteredGalleryImages.push(...imagesForVariant);
          } else {
              if(this.product?.image) {
                 this.filteredGalleryImages.push(this.getFullImageUrl(this.product.image.split('?')[0]));
              }
          }
      } else {
          if (this.variantImageMap['default']) {
               this.filteredGalleryImages.push(...this.variantImageMap['default']);
          }
      }

      if (this.filteredGalleryImages.length > 0) {
          this.selectedImage = this.filteredGalleryImages[0];
      } else {
          this.selectedImage = this.defaultPlaceholder;
      }
  }

  showAllImages(): void {
      this.selectedVariant = null;
      this.filteredGalleryImages = [];

      if (this.videoUrl) this.filteredGalleryImages.push(this.videoUrl);

      const allUrls = new Set<string>();
      if (this.product?.image) {
          allUrls.add(this.getFullImageUrl(this.product.image.split('?')[0]));
      }
      Object.values(this.variantImageMap).forEach(imgs => {
          imgs.forEach(url => allUrls.add(url));
      });

      this.filteredGalleryImages.push(...Array.from(allUrls));

      if (this.filteredGalleryImages.length > 0) {
          this.selectedImage = this.filteredGalleryImages[0];
      }
  }

  loadRelatedProducts(product: Product): void {
    this.productService.getProductsByCategory(product.category).subscribe({
      next: (products) => {
        this.relatedProducts = products
          .filter(p => p.id !== product.id)
          .slice(0, 4)
          .map(p => ({
            ...p,
            image: this.getFullImageUrl(p.image?.split('?')[0]) || this.defaultPlaceholder
          }));
      },
      error: (error: any) => console.error('Error loading related products:', error)
    });
  }

  changeImage(image: string): void { this.selectedImage = image; }
  increaseQuantity(): void { if (this.product && this.quantity < this.product.stock) this.quantity++; else alert('Đã đạt số lượng tối đa!'); }
  decreaseQuantity(): void { if (this.quantity > 1) this.quantity--; }

  // --- CẬP NHẬT: Yêu cầu đăng nhập khi thêm giỏ hàng ---
  addToCart(): void {
    if (!this.authService.isLoggedIn) {
      alert('Vui lòng đăng nhập để thêm vào giỏ hàng!');
      this.router.navigate(['/login']);
      return;
    }

    if (this.product) {
      let cartImage = this.selectedImage;
      if (this.isMediaVideo(cartImage)) {
           cartImage = this.filteredGalleryImages.find(img => !this.isMediaVideo(img)) || this.defaultPlaceholder;
      }
      const productForCart = { ...this.product, image: cartImage };

      this.cartService.addToCartFrontend(productForCart, this.quantity).subscribe({
        next: () => alert(`Đã thêm ${this.quantity} ${this.product?.name} vào giỏ hàng!`),
        error: (error: any) => alert('Lỗi thêm giỏ hàng')
      });
    }
  }

  // --- CẬP NHẬT: Yêu cầu đăng nhập khi mua ngay ---
  buyNow(): void {
    if (!this.authService.isLoggedIn) {
      alert('Vui lòng đăng nhập để mua ngay!');
      this.router.navigate(['/login']);
      return;
    }

    if (this.product) {
        this.addToCart();
        this.router.navigate(['/checkout']);
    }
  }

  isMediaVideo(url: string): boolean {
    if (!this.videoUrl) return false;
    return url === this.videoUrl;
  }

  addToWishlist(): void {
    if (this.product && this.product.id) {
        if(this.authService.isLoggedIn) {
            this.authService.addToWishlist(String(this.product.id)).subscribe({
                next: (res: any) => alert(res.success ? '❤️ ' + res.message : 'ℹ️ ' + res.message),
                error: () => alert('Lỗi thao tác')
            });
        } else {
            alert('🔐 Vui lòng đăng nhập!');
            this.router.navigate(['/login']);
        }
    }
  }

  isInWishlist(): boolean {
    return this.authService.currentUserValue?.wishlist?.includes(String(this.product?.id)) || false;
  }

  getDiscount(): number {
    if (this.product?.originalPrice && this.product.originalPrice > this.product.price) {
        return Math.round(((this.product.originalPrice - this.product.price) / this.product.originalPrice) * 100);
    }
    return 0;
  }

  getStarRating(rating: number): string {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    return '★'.repeat(fullStars) + '½'.repeat(halfStar) + '☆'.repeat(emptyStars);
  }

  setActiveTab(tab: string): void { this.activeTab = tab; }

  onSubmitReview(reviewForm: NgForm): void {
    if (reviewForm.invalid) { alert('Vui lòng nhập đủ thông tin.'); return; }
    if (!this.authService.isLoggedIn) { this.router.navigate(['/login']); return; }
    this.isSubmittingReview = true;
    this.newReview.author = this.authService.userName || 'Khách hàng';
    this.productService.addReview(this.product!.id, this.newReview).subscribe({
        next: (updated) => { this.product = updated; alert('Đánh giá thành công!'); reviewForm.resetForm(); this.isSubmittingReview = false; },
        error: () => { alert('Lỗi gửi đánh giá.'); this.isSubmittingReview = false; }
    });
  }

  hasSpec(spec: any): boolean { return spec !== undefined && spec !== null && spec !== ''; }
  showAdminNotice(): boolean { return this.authService.isAdminSync(); }
  getSupportPhone(): string { return (this.product as any)?.supportPhone || '1900 1234'; }
  getReturnPolicyText(): string { return `Đổi trả ${(this.product as any)?.returnPolicyDays || 30} ngày`; }

  getConnectivityLabel(code: string | undefined): string {
    if (!code) return '';
    const map: Record<string, string> = {
      'wireless': 'Không dây',
      'wired': 'Có dây'
    };
    return map[code.toLowerCase()] || code;
  }
}
