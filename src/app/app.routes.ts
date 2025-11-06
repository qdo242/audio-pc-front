import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

import { ProductDetail } from './pages/product-detail/product-detail';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Cart } from './pages/cart/cart';
import { Checkout } from './pages/checkout/checkout';
import { authGuard } from './guards/auth-guard';
import { Admin } from './pages/admin/admin';
import { adminGuard } from './guards/admin-guard';
import { Products } from './pages/products/products';
import { ForgotPassword } from './pages/forgot-password/forgot-password';


import { Wishlist } from './pages/wishlist/wishlist';
import { Profile } from './pages/profile/profile';
import { OrderHistory } from './pages/order-history/order-history';
// import { About } from './pages/about/about';
// import { Contact } from './pages/contact/contact';

export const routes: Routes = [
    {path: '', component:Home},
    {path:'products', component:Products},
    {path:'products/:id', component:ProductDetail},
    {path:'login', component:Login},
    {path:'register',component:Register},
    { path: 'forgot-password', component: ForgotPassword },
    {path:'cart', component:Cart},
    {path:'checkout', component:Checkout, canActivate:[authGuard]},
    {path:'admin', component: Admin, canActivate:[authGuard,adminGuard]},

    
    { path: 'wishlist', component: Wishlist, canActivate: [authGuard] },
    { path: 'profile', component: Profile, canActivate: [authGuard] },
    { path: 'orders', component: OrderHistory, canActivate: [authGuard] },
    // { path: 'about', component: About },
    // { path: 'contact', component: Contact },
   

    {path: '**', redirectTo: ''}
];