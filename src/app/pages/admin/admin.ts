import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Product } from '../../interfaces/product';
import { ProductService } from '../../services/product';
import { AuthService } from '../../services/auth';
import { Order, OrderService } from '../../services/order';
import { FileService } from '../../services/file';
import { ChatService, ChatMessage } from '../../services/chat';
import { User } from '../../interfaces/user';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss']
})
export class Admin implements OnInit, AfterViewChecked {
  products: Product[] = [];
  orders: Order[] = []; 
  activeTab: string = 'products';
  
  showProductForm = false;
  editingProduct: Product | null = null;
  isUploading: boolean = false; 
  
  productForm: Partial<Product> = {
    name: '', price: 0, originalPrice: 0, category: 'headphone', brand: 'Atheng Audio',
    description: '', videoUrl: null, image: '', images: [''], stock: 100, isActive: true, 
    isFeatured: false, rating: 0, reviewCount: 0
  };

  stats = { totalProducts: 0, totalOrders: 0, totalRevenue: 0, outOfStock: 0 };

  // Chat Variables
  conversations: User[] = [];
  selectedChatUser: User | null = null;
  adminMessage: string = '';
  chatMessages: ChatMessage[] = [];
  
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  private shouldScroll = false;

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    public authService: AuthService,
    private fileService: FileService, 
    private router: Router,
    private chatService: ChatService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadOrders();
    
    // 1. Lắng nghe kho tin nhắn ADMIN để hiển thị trong khung chat
    this.chatService.adminMessages$.subscribe((msgs: ChatMessage[]) => {
      // Chỉ cập nhật nếu đang mở khung chat
      if (this.selectedChatUser) {
        this.chatMessages = msgs;
        this.shouldScroll = true;
        this.cdr.detectChanges();
      }
    });

    // 2. Lắng nghe sự kiện tin nhắn mới để cập nhật Sidebar (Real-time)
    this.chatService.onMessage$.subscribe((msg: ChatMessage) => {
      this.ngZone.run(() => {
        this.handleSidebarUpdate(msg);
      });
    });
    
    // Tải danh sách hội thoại lần đầu
    this.loadConversations();
  }

  // Xử lý logic cập nhật Sidebar khi có tin mới
  handleSidebarUpdate(msg: ChatMessage) {
    // Bỏ qua tin nhắn của Bot
    if (msg.from === 'BOT' || msg.to === 'BOT') return;

    const currentAdminId = this.authService.currentUserValue?.id;

    // Xác định đối phương là ai (Người gửi hoặc Người nhận, miễn ko phải là Admin)
    const partnerId = (msg.from === currentAdminId) ? msg.to : msg.from;

    // Tìm xem đối phương đã có trong danh sách chưa
    const index = this.conversations.findIndex(u => u.id === partnerId);

    if (index > -1) {
        const user = this.conversations[index];
        
        // Nếu Admin KHÔNG đang chat với người này -> Tăng unread
        // (Nếu msg.from === currentAdminId nghĩa là Admin gửi, không cần tăng unread)
        if (msg.from !== currentAdminId && (!this.selectedChatUser || this.selectedChatUser.id !== partnerId)) {
            user.unreadCount = (user.unreadCount || 0) + 1;
        }

        // Đẩy lên đầu danh sách
        this.conversations.splice(index, 1);
        this.conversations.unshift(user);
        
    } else {
        // Nếu chưa có (User mới nhắn tin lần đầu) -> Tải lại danh sách
        this.loadConversations();
    }
    this.cdr.detectChanges();
  }

  ngAfterViewChecked() {
    if (this.shouldScroll && this.chatContainer) {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  // === CÁC HÀM CHAT ===

  loadConversations(): void {
    this.chatService.getConversations().subscribe({
      next: (res) => {
        if (res.success) {
          // Giữ lại trạng thái unread cũ nếu reload
          const oldConversations = this.conversations;
          this.conversations = res.users.map(u => {
            const old = oldConversations.find(oldU => oldU.id === u.id);
            return { ...u, unreadCount: old ? old.unreadCount : 0 };
          });
        }
      },
      error: (err) => console.error('Lỗi tải hội thoại:', err)
    });
  }

  selectUserToChat(user: User): void {
    this.selectedChatUser = user;
    user.unreadCount = 0; // Đánh dấu đã đọc
    this.chatService.loadChatWithUser(user.id); // Gọi service load tin nhắn
  }

  sendAdminMessage(): void {
    if (!this.adminMessage.trim() || !this.selectedChatUser) return;
    
    this.chatService.sendMessage(this.adminMessage, this.selectedChatUser.id);
    this.adminMessage = '';
    this.shouldScroll = true;
  }

  // === CÁC HÀM QUẢN LÝ SẢN PHẨM/ĐƠN HÀNG (Giữ nguyên logic cũ) ===
  
  getFullImageUrl(url: string | undefined): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    if (!url || url.trim() === '') return ''; 
    if (url.startsWith('http')) return url;
    return `http://localhost:8080${url}`; 
  }

  getSafeDisplayImage(product: Product): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    let coverImage = this.getFullImageUrl(product.image);
    if (coverImage && !coverImage.endsWith('default-product.png')) return coverImage;
    if (product.images && product.images.length > 0) {
       const firstGalleryImage = this.getFullImageUrl(product.images[0]);
       if (firstGalleryImage && !firstGalleryImage.endsWith('default-product.png')) return firstGalleryImage;
    }
    return defaultPlaceholder;
  }

  loadProducts(): void {
    this.productService.getAllProducts().subscribe({
      next: (products) => {
        this.products = products.map(p => ({ ...p, image: this.getSafeDisplayImage(p) }));
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
      error: (error) => console.error('Error loading orders:', error)
    });
  }

  calculateStats(): void {
    this.stats.totalProducts = this.products.length;
    this.stats.totalOrders = this.orders.length;
    this.stats.totalRevenue = this.orders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + o.totalAmount, 0);
    this.stats.outOfStock = this.products.filter(p => (p.stock || 0) <= 0).length;
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'chat') {
      this.loadConversations();
    }
  }

  // CRUD Sản phẩm
  addProduct(): void {
    this.editingProduct = null;
    this.productForm = { name: '', price: 0, originalPrice: 0, category: 'headphone', brand: 'Atheng Audio', description: '', videoUrl: null, image: '', images: [''], stock: 100, isActive: true, isFeatured: false, rating: 0, reviewCount: 0 };
    this.showProductForm = true;
  }

  editProduct(product: Product): void {
    this.editingProduct = product;
    this.productForm = { ...product, videoUrl: product.videoUrl || null, image: product.image || '', images: (product.images && product.images.length > 0) ? product.images : [''] };
    this.showProductForm = true;
  }

  saveProduct(): void {
    const finalGallery = (this.productForm.images || []).filter(url => url && url.trim() !== '');
    const payload: Partial<Product> = { ...this.productForm, image: finalGallery[0] || '', images: finalGallery, videoUrl: this.productForm.videoUrl };
    
    if (this.editingProduct && this.editingProduct.id) {
      this.productService.updateProduct(this.editingProduct.id, payload).subscribe({ next: () => { this.showProductForm = false; this.loadProducts(); }, error: (error) => console.error('Error updating product:', error) });
    } else {
      delete payload.id; 
      this.productService.createProduct(payload).subscribe({ next: () => { this.showProductForm = false; this.loadProducts(); }, error: (error) => console.error('Error adding product:', error) });
    }
  }

  deleteProduct(productId: string | undefined): void { 
    if (!productId) return;
    if (confirm('Bạn có chắc muốn xóa (ẩn) sản phẩm này?')) {
      this.productService.deleteProduct(productId).subscribe({ next: () => this.loadProducts(), error: (error) => console.error('Error deleting product:', error) });
    }
  }

  cancelEdit(): void { this.showProductForm = false; this.editingProduct = null; }

  onFileSelected(event: Event, fieldType: 'video' | 'images', index?: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.isUploading = true; input.disabled = true; 

    this.fileService.upload(file).subscribe({
      next: (response) => {
        if (response.success && response.url) {
          const fullUrl = `http://localhost:8080${response.url}`; 
          if (fieldType === 'video') { this.productForm.videoUrl = fullUrl; } 
          else if (fieldType === 'images' && index !== undefined) {
            if (!this.productForm.images) this.productForm.images = [];
            this.productForm.images[index] = fullUrl;
          }
          alert('Tải file thành công!');
        } else { alert('Upload thất bại: ' + (response.message || 'Không rõ lỗi')); }
        this.isUploading = false; input.disabled = false; input.value = ''; 
      },
      error: (err) => { console.error('Upload error:', err); alert('Lỗi nghiêm trọng khi upload file.'); this.isUploading = false; input.disabled = false; input.value = ''; }
    });
  }

  addImageField(): void { if (!this.productForm.images) { this.productForm.images = []; } this.productForm.images.push(''); }
  removeImageField(index: number): void { if (this.productForm.images) { this.productForm.images.splice(index, 1); } }

  // CRUD Order
  updateOrderStatus(orderId: string | undefined, event: Event): void {
    if (!orderId) return;
    const target = event.target as HTMLSelectElement;
    const status = target.value as Order['status'];
    this.orderService.updateOrderStatus(orderId, status).subscribe({ next: () => this.loadOrders(), error: (error) => console.error('Error updating order status:', error) });
  }

  viewOrder(orderId: string | undefined): void {
    if (!orderId) return;
    const order = this.orders.find(o => o.id === orderId);
    if (order) { alert(`Chi tiết đơn hàng #${orderId}\nKhách hàng: ${order.shippingAddress.fullName}\nTổng tiền: ${order.totalAmount.toLocaleString()}₫\nTrạng thái: ${this.getStatusText(order.status)}`); }
  }

  deleteOrder(orderId: string | undefined): void {
    if (!orderId) return;
    if (confirm('Bạn có chắc muốn xóa vĩnh viễn đơn hàng này?')) {
      this.orderService.deleteOrder(orderId).subscribe({ next: () => this.loadOrders(), error: (error) => console.error('Error deleting order:', error) });
    }
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý', SHIPPED: 'Đã giao hàng', DELIVERED: 'Đã nhận', CANCELLED: 'Đã hủy' };
    return statusMap[status] || status;
  }

  getStatusColor(status: string): string {
    const colors: { [key:string]: string } = { PENDING: '#fbbf24', CONFIRMED: '#3b82f6', PROCESSING: '#3b82f6', SHIPPED: '#8b5cf6', DELIVERED: '#10b981', CANCELLED: '#ef4444' };
    return colors[status] || '#6b7280';
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => { this.router.navigate(['/login']); },
      error: (error) => { console.error('Error logging out:', error); }
    });
  }
}