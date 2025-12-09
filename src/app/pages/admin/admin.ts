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

export const PREDEFINED_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#008000' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Pink', hex: '#FFC0CB' },
];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss']
})
export class Admin implements OnInit, AfterViewChecked {
  // --- KHAI BÁO BIẾN ---
  products: Product[] = [];
  orders: Order[] = [];
  activeTab: string = 'products';

  showProductForm = false;
  editingProduct: Product | null = null;
  isUploading: boolean = false;

  productForm: Partial<Product> = {
    name: '', price: 0, originalPrice: 0, category: 'headphone', brand: 'Atheng Audio',
    description: '', videoUrl: null, image: '', images: [''],
    stock: 0, isActive: true, isFeatured: false, rating: 0, reviewCount: 0,
    connectivity: 'wireless', colors: [], type: '', supportPhone: '1900 1234', returnPolicyDays: 30, features: ['']
  };

  colorVariantGroups: { colorName: string; imageUrls: string[]; }[] = [];
  predefinedColors = PREDEFINED_COLORS;
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
    this.loadConversations();

    // 1. Lắng nghe nội dung tin nhắn (để hiển thị vào khung chat bên phải)
    this.chatService.adminMessages$.subscribe((msgs: ChatMessage[]) => {
      this.ngZone.run(() => {
        if (this.selectedChatUser) {
          this.chatMessages = msgs;
          this.shouldScroll = true; // Cuộn xuống khi tải xong lịch sử
          this.cdr.detectChanges();
        }
      });
    });

    // 2. Lắng nghe tin nhắn mới đến (để cập nhật Sidebar và Chat nếu đang mở)
    this.chatService.onMessage$.subscribe((msg: ChatMessage) => {
      this.ngZone.run(() => {
        this.handleSidebarUpdate(msg);

        // Nếu tin nhắn này thuộc về cuộc trò chuyện đang mở
        const currentAdminId = this.authService.currentUserValue?.id;
        const partnerId = (msg.from === currentAdminId) ? msg.to : msg.from;

        if (this.selectedChatUser && this.selectedChatUser.id === partnerId) {
             // Thêm vào danh sách hiện tại để hiển thị ngay
             const exists = this.chatMessages.some(m => m.timestamp === msg.timestamp && m.content === msg.content);
             if (!exists) {
                this.chatMessages = [...this.chatMessages, msg];
                this.shouldScroll = true; // Cuộn xuống khi có tin mới
                this.cdr.detectChanges();
             }
        }
      });
    });
  }

  // --- XỬ LÝ SIDEBAR: HIỆN TIN NHẮN MỚI NHẤT ---
  handleSidebarUpdate(msg: ChatMessage) {
    // Bỏ qua tin Bot
    if (msg.from === 'BOT' || msg.to === 'BOT') return;

    const currentAdminId = this.authService.currentUserValue?.id;
    const partnerId = (msg.from === currentAdminId) ? msg.to : msg.from;
    const isAdminSending = (msg.from === currentAdminId);

    // Chuẩn bị nội dung hiển thị (Preview)
    const previewText = isAdminSending ? `Bạn: ${msg.content}` : msg.content;

    const index = this.conversations.findIndex(u => u.id === partnerId);

    if (index > -1) {
      // CASE 1: User đã có trong danh sách
      const user = { ...this.conversations[index] };

      // Cập nhật dòng phụ (email) thành nội dung tin nhắn để admin dễ thấy
      user.email = previewText;

      // Tăng unread nếu Admin không đang chat với người này
      if (!isAdminSending && (!this.selectedChatUser || this.selectedChatUser.id !== partnerId)) {
        user.unreadCount = (user.unreadCount || 0) + 1;
      }

      // Đưa lên đầu danh sách
      const list = [...this.conversations];
      list.splice(index, 1);
      list.unshift(user);
      this.conversations = list;
      this.cdr.detectChanges();

    } else {
      // CASE 2: User MỚI - Tạo ngay để hiện "alo" lập tức
      const newUser: User = {
        id: partnerId,
        name: msg.fromName || 'Khách hàng mới',
        email: previewText, // Hiển thị ngay nội dung tin nhắn vào chỗ email
        role: 'user', createdAt: new Date(), updatedAt: new Date(),
        unreadCount: isAdminSending ? 0 : 1
      };

      this.conversations = [newUser, ...this.conversations];
      this.cdr.detectChanges();

      // Gọi API ngầm để lấy Tên thật/Avatar nếu có (nhưng không ghi đè nội dung chat preview)
      this.chatService.getConversations().subscribe(res => {
        if (res.success) {
          const realUser = res.users.find(u => u.id === partnerId);
          if (realUser) {
            const list = [...this.conversations];
            const idx = list.findIndex(u => u.id === partnerId);
            if (idx > -1) {
              // Cập nhật tên thật, nhưng giữ lại preview tin nhắn (email) và unreadCount
              list[idx] = {
                ...realUser,
                email: list[idx].email, // Giữ lại tin nhắn preview
                unreadCount: list[idx].unreadCount
              };
              this.conversations = list;
              this.cdr.detectChanges();
            }
          }
        }
      });
    }
  }

  loadConversations(): void {
    this.chatService.getConversations().subscribe({
      next: (res) => {
        if (res.success) {
          const old = this.conversations;
          this.conversations = res.users.map(u => {
            const match = old.find(o => o.id === u.id);
            return { ...u, unreadCount: match ? match.unreadCount : 0 };
          });
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Lỗi tải hội thoại:', err)
    });
  }

  selectUserToChat(user: User): void {
    this.selectedChatUser = user;

    // Xóa badge đỏ
    const idx = this.conversations.findIndex(u => u.id === user.id);
    if (idx > -1) {
      const list = [...this.conversations];
      list[idx] = { ...list[idx], unreadCount: 0 };
      this.conversations = list;
    }

    // Gọi API lấy lịch sử từ MongoDB
    this.chatService.loadChatWithUser(user.id);
    this.shouldScroll = true;
  }

  sendAdminMessage(): void {
    if (!this.adminMessage.trim() || !this.selectedChatUser) return;

    // 1. Gửi socket (Backend sẽ lưu vào MongoDB)
    this.chatService.sendMessage(this.adminMessage, this.selectedChatUser.id);

    // 2. Hiển thị ngay lập tức (Optimistic UI)
    const tempMsg: ChatMessage = {
      from: this.authService.currentUserValue?.id || 'admin',
      to: this.selectedChatUser.id,
      content: this.adminMessage,
      fromName: 'Hỗ trợ viên',
      timestamp: Date.now()
    };
    this.chatMessages = [...this.chatMessages, tempMsg];

    // 3. Cập nhật Sidebar preview
    const userIdx = this.conversations.findIndex(u => u.id === this.selectedChatUser?.id);
    if (userIdx > -1) {
        const user = { ...this.conversations[userIdx], email: `Bạn: ${this.adminMessage}` };
        const list = [...this.conversations];
        list.splice(userIdx, 1);
        list.unshift(user);
        this.conversations = list;
    }

    this.adminMessage = '';
    this.shouldScroll = true;
  }

  // --- HÀM CUỘN TỰ ĐỘNG ---
  scrollToBottom(): void {
    try {
      setTimeout(() => {
        if (this.chatContainer) {
          this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
        }
      }, 50);
    } catch (err) {
      console.error('Scroll error:', err);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  // =========================================================
  // === CÁC HÀM QUẢN LÝ SẢN PHẨM & ĐƠN HÀNG (GIỮ NGUYÊN) ===
  // =========================================================

  getFullImageUrl(url: string | undefined): string { if (!url || url.trim() === '') return ''; if (url.startsWith('http')) return url; return `http://localhost:8080${url}`; }
  getSafeDisplayImage(p: Product): string { let u = p.image; if (!u && p.images?.length) u = p.images[0]; if (!u) return 'assets/images/default-product.png'; return this.getFullImageUrl(u.split('?')[0]); }
  loadProducts(): void { this.productService.getAllProducts().subscribe(p => { this.products = p.map(x => ({...x, image: this.getSafeDisplayImage(x)})); this.calculateStats(); }); }
  loadOrders(): void { this.orderService.getAllOrders().subscribe(o => { this.orders = o; this.calculateStats(); }); }
  calculateStats(): void { this.stats.totalProducts = this.products.length; this.stats.totalOrders = this.orders.length; this.stats.totalRevenue = this.orders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0); this.stats.outOfStock = this.products.filter(p => (p.stock || 0) <= 0).length; }
  setActiveTab(t: string): void { this.activeTab = t; if (t === 'chat') this.loadConversations(); }

  addProduct(): void { this.editingProduct = null; this.productForm = { name: '', price: 0, category: 'headphone', brand: 'Atheng Audio', stock: 100, isActive: true, images: [''], colors: [], features: [''] }; this.showProductForm = true; this.colorVariantGroups = [{ colorName: '#000000', imageUrls: [''] }]; }
  editProduct(p: Product): void { this.editingProduct = p; this.productForm = { ...p, videoUrl: p.videoUrl ? this.getFullImageUrl(p.videoUrl) : null, image: p.image || '', images: [], features: p.features || [''] }; this.loadProductDataToGroups(p); this.showProductForm = true; }
  saveProduct(): void {
    if (this.productForm.stock !== undefined && this.productForm.stock < 0) { alert('Lỗi tồn kho'); return; }
    const finalColors: string[] = [], finalImages: string[] = []; let cover = '';
    this.colorVariantGroups.forEach(g => { if(g.colorName.trim()) finalColors.push(g.colorName.trim()); g.imageUrls.filter(u => u && u.trim()).forEach(u => { let clean = u.replace('http://localhost:8080','').split('?')[0]; finalImages.push(`${clean}?color=${encodeURIComponent(g.colorName.trim())}`); if(!cover) cover = clean; }); });
    if(!cover && this.productForm.image) cover = this.productForm.image;
    const payload = { ...this.productForm, colors: finalColors, images: finalImages, image: cover, videoUrl: this.productForm.videoUrl ? this.productForm.videoUrl.replace('http://localhost:8080','') : null };
    const req = (this.editingProduct?.id) ? this.productService.updateProduct(this.editingProduct.id, payload) : (delete payload.id, this.productService.createProduct(payload));
    req.subscribe({ next: () => { this.showProductForm = false; this.loadProducts(); }, error: e => console.error(e) });
  }
  deleteProduct(id: string): void { if(confirm('Xóa?')) this.productService.deleteProduct(id).subscribe(() => this.loadProducts()); }
  cancelEdit(): void { this.showProductForm = false; this.editingProduct = null; this.colorVariantGroups = []; }

  onFileSelected(e: Event, gi: number, ii: number): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.isUploading = true;
    this.fileService.upload(file).subscribe({
      next: (res) => { if(res.success) { const url = `http://localhost:8080${res.url}`; if(gi >= 0) { const g = this.colorVariantGroups[gi]; const imgs = [...g.imageUrls]; imgs[ii] = url; g.imageUrls = imgs; this.cdr.detectChanges(); } } this.isUploading = false; },
      error: () => this.isUploading = false
    });
  }
  onVideoSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.isUploading = true;
    this.fileService.upload(file).subscribe({ next: (res) => { if(res.success) this.productForm.videoUrl = `http://localhost:8080${res.url}`; this.isUploading = false; }, error: () => this.isUploading = false });
  }

  loadProductDataToGroups(p: Product): void {
    this.colorVariantGroups = []; const map = new Map<string, string[]>();
    (p.colors || []).forEach(c => map.set(c, [])); const unassigned: string[] = [];
    (p.images || []).forEach(img => { const [url, param] = img.split('?color='); const color = param ? decodeURIComponent(param) : null; if(color && map.has(color)) map.get(color)?.push(this.getFullImageUrl(url)); else unassigned.push(this.getFullImageUrl(url)); });
    map.forEach((imgs, name) => this.colorVariantGroups.push({colorName: name, imageUrls: imgs.length ? imgs : ['']}));
    if(unassigned.length) { if(this.colorVariantGroups.length) unassigned.forEach(u => {if(!this.colorVariantGroups[0].imageUrls.includes(u)) this.colorVariantGroups[0].imageUrls.push(u)}); else this.colorVariantGroups.push({colorName: 'Mặc định', imageUrls: unassigned}); }
    if(!this.colorVariantGroups.length) this.colorVariantGroups.push({colorName: 'Mặc định', imageUrls: ['']});
  }

  addColorGroup(): void { this.colorVariantGroups.push({ colorName: '#000000', imageUrls: [''] }); }
  removeColorGroup(i: number): void { if(this.colorVariantGroups.length > 1) this.colorVariantGroups.splice(i, 1); }
  addImageToGroup(g: any): void { g.imageUrls.push(''); }
  removeImageFromGroup(g: any, i: number): void { g.imageUrls.length > 1 ? g.imageUrls.splice(i, 1) : g.imageUrls[0] = ''; }
  addFeatureField(): void { if (!this.productForm.features) this.productForm.features = []; this.productForm.features.push(''); }
  removeFeatureField(i: number): void { this.productForm.features?.splice(i, 1); }
  setColorFromSwatch(g: any, v: string): void { g.colorName = v; }

  updateOrderStatus(id: string | undefined, e: Event): void { if(!id) return; this.orderService.updateOrderStatus(id, (e.target as any).value).subscribe(() => this.loadOrders()); }

  viewOrder(orderId: string | undefined): void {
    if (!orderId) return;
    const order = this.orders.find(o => o.id === orderId);

    if (order) {
      // Format ngày tháng sang tiếng Việt dễ đọc
      const dateStr = order.createdAt
        ? new Date(order.createdAt).toLocaleString('vi-VN')
        : 'N/A';

      alert(
        `Chi tiết đơn hàng #${orderId}\n` +
        `----------------------------\n` +
        `Khách hàng: ${order.shippingAddress.fullName}\n` +
        `Thời gian: ${dateStr}\n` + // Dòng mới thêm
        `Tổng tiền: ${order.totalAmount.toLocaleString()}₫\n` +
        `Trạng thái: ${this.getStatusText(order.status)}`
      );
    }
  }
  // viewOrder(id: string | undefined): void { if(!id) return; const o = this.orders.find(x => x.id === id); if(o) alert(`Đơn hàng #${id}\nKhách: ${o.shippingAddress.fullName}\nTổng: ${o.totalAmount.toLocaleString()}₫`); }
  deleteOrder(id: string | undefined): void { if(id && confirm('Xóa?')) this.orderService.deleteOrder(id).subscribe(() => this.loadOrders()); }
  getStatusText(s: string): string { return s; }
  getStatusColor(s: string): string { return '#ccc'; }
  logout(): void { this.authService.logout().subscribe({ next: () => this.router.navigate(['/login']) }); }
}
