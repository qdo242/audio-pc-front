import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Product } from '../../interfaces/product';
import { ProductService } from '../../services/product';
import { AuthService } from '../../services/auth';
import { Order, OrderService } from '../../services/order';
import { FileService } from '../../services/file';
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss']
})
export class Admin implements OnInit {
  products: Product[] = [];
  orders: Order[] = []; 
  activeTab: string = 'products';
  
  showProductForm = false;
  editingProduct: Product | null = null;
  isUploading: boolean = false; 
  
  productForm: Partial<Product> = {
    name: '',
    price: 0,
    originalPrice: 0,
    category: 'headphone',
    brand: 'Atheng Audio',
    description: '',
    image: '',
    images: [''],
    stock: 100,
    isActive: true, 
    isFeatured: false,
    rating: 0,
    reviewCount: 0
  };

  
  stats = {
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    outOfStock: 0
  };

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    public authService: AuthService,
    private fileService: FileService, 
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadOrders();
  }

  // SỬA: THÊM HÀM HELPER NÀY (Fix ảnh vỡ ở bảng admin)
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
  getSafeDisplayImage(product: Product): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    let imageUrl = this.getFullImageUrl(product.image);
    
    if (!imageUrl || imageUrl.endsWith('default-product.png')) { 
      if (product.images && product.images.length > 0) {
        const firstGalleryImage = this.getFullImageUrl(product.images[0]);
        if (firstGalleryImage && !firstGalleryImage.endsWith('default-product.png')) {
          imageUrl = firstGalleryImage;
        }
      }
    }
    return imageUrl || defaultPlaceholder;
  }

  loadProducts(): void {
    this.productService.getAllProducts().subscribe({
      next: (products) => {
        // SỬA: Dùng map để sửa URL ảnh (ảnh 1860a7.png)
        this.products = products.map(p => ({
          ...p,
          image: this.getSafeDisplayImage(p) // Dùng logic thông minh
        }));
        this.calculateStats();
      },
      error: (error) => console.error('Error loading products:', error)
    });
  }

  loadOrders(): void {
    this.orderService.getAllOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.calculateStats();
      },
      error: (error) => {
        console.error('Error loading orders:', error);
      }
    });
  }

  calculateStats(): void {
    this.stats.totalProducts = this.products.length;
    this.stats.totalOrders = this.orders.length;
    this.stats.totalRevenue = this.orders
      .filter(order => order.status === 'DELIVERED') 
      .reduce((sum, order) => sum + order.totalAmount, 0);
    this.stats.outOfStock = this.products.filter(p => (p.stock || 0) <= 0).length;
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  addProduct(): void {
    this.editingProduct = null;
    this.productForm = {
      name: '',
      price: 0,
      originalPrice: 0,
      category: 'headphone',
      brand: 'Atheng Audio',
      description: '',
      image: '',
      images: [''],
      stock: 100,
      isActive: true,
      isFeatured: false,
      rating: 0,
      reviewCount: 0
    };
    this.showProductForm = true;
  }

  editProduct(product: Product): void {
    this.editingProduct = product;
    this.productForm = { 
      ...product,
      images: (product.images && product.images.length > 0) ? [...product.images] : ['']
    };
    this.showProductForm = true;
  }

  saveProduct(): void {
    if (this.productForm.images) {
      this.productForm.images = this.productForm.images.filter(url => url && url.trim() !== '');
    }
    
    if (this.editingProduct && this.editingProduct.id) {
      this.productService.updateProduct(this.editingProduct.id, this.productForm).subscribe({
        next: () => {
          this.showProductForm = false;
          this.loadProducts();
        },
        error: (error) => console.error('Error updating product:', error)
      });
    } else {
      const newProductData: Partial<Product> = { ...this.productForm };
      delete newProductData.id; 
      
      this.productService.createProduct(newProductData).subscribe({
        next: () => {
          this.showProductForm = false;
          this.loadProducts();
        },
        error: (error) => console.error('Error adding product:', error)
      });
    }
  }

  deleteProduct(productId: string | undefined): void { 
    if (!productId) return;
    if (confirm('Bạn có chắc muốn xóa (ẩn) sản phẩm này?')) {
      this.productService.deleteProduct(productId).subscribe({
        next: () => this.loadProducts(),
        error: (error) => console.error('Error deleting product:', error)
      });
    }
  }

  cancelEdit(): void {
    this.showProductForm = false;
    this.editingProduct = null;
  }

  onFileSelected(event: Event, fieldType: 'image' | 'images', index?: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    this.isUploading = true;
    input.disabled = true; 

    this.fileService.upload(file).subscribe({
      next: (response) => {
        if (response.success && response.url) {
          const fullUrl = `http://localhost:8080${response.url}`; 
          
          if (fieldType === 'image') {
            this.productForm.image = fullUrl;
          } 
          else if (fieldType === 'images' && index !== undefined && this.productForm.images) {
            this.productForm.images[index] = fullUrl;
          }
          alert('Tải ảnh thành công!');
        } else {
          // SỬA LỖI TS2349: Thêm dấu +
          alert('Upload thất bại: ' + (response.message || 'Không rõ lỗi'));
        }
        this.isUploading = false;
        input.disabled = false;
        input.value = ''; 
      },
      error: (err) => {
        console.error('Upload error:', err);
        alert('Lỗi nghiêm trọng khi upload file.');
        this.isUploading = false;
        input.disabled = false;
        input.value = ''; 
      }
    });
  }

  addImageField(): void {
    if (!this.productForm.images) {
      this.productForm.images = [];
    }
    this.productForm.images.push('');
  }

  removeImageField(index: number): void {
    this.productForm.images?.splice(index, 1);
  }

  trackByFn(index: number, item: any): any {
    return index;
  }

  updateOrderStatus(orderId: string | undefined, event: Event): void {
    if (!orderId) return;
    const target = event.target as HTMLSelectElement;
    const status = target.value as Order['status'];
    
    this.orderService.updateOrderStatus(orderId, status).subscribe({
      next: () => this.loadOrders(),
      error: (error) => console.error('Error updating order status:', error)
    });
  }

  viewOrder(orderId: string | undefined): void {
    if (!orderId) return;
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
      alert(`Chi tiết đơn hàng #${orderId}\nKhách hàng: ${order.shippingAddress.fullName}\nTổng tiền: ${order.totalAmount.toLocaleString()}₫\nTrạng thái: ${this.getStatusText(order.status)}`);
    }
  }

  deleteOrder(orderId: string | undefined): void {
    if (!orderId) return;
    if (confirm('Bạn có chắc muốn xóa vĩnh viễn đơn hàng này?')) {
      this.orderService.deleteOrder(orderId).subscribe({
        next: () => this.loadOrders(),
        error: (error) => console.error('Error deleting order:', error)
      });
    }
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      PENDING: 'Chờ xử lý',
      CONFIRMED: 'Đã xác nhận',
      PROCESSING: 'Đang xử lý',
      SHIPPED: 'Đã giao hàng',
      DELIVERED: 'Đã nhận',
      CANCELLED: 'Đã hủy'
    };
    return statusMap[status] || status;
  }

  getStatusColor(status: string): string {
    const colors: { [key:string]: string } = {
      PENDING: '#fbbf24',
      CONFIRMED: '#3b82f6',
      PROCESSING: '#3b82f6',
      SHIPPED: '#8b5cf6',
      DELIVERED: '#10b981',
      CANCELLED: '#ef4444'
    };
    return colors[status] || '#6b7280';
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Error logging out:', error);
      }
    });
  }
}