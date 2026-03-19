import { Login } from "@/api/interface/index";
import http from "@/api";

/**
 * @name 登录模块
 */
// 用户登录
export const loginApi = (params: Login.ReqLoginForm) => {
  return http.post<Login.ResLogin>(`/login`, params, { loading: false }); // VITE_API_URL 已经是 /api 了，所以这里直接写 /login
};

// 获取菜单列表
export const getAuthMenuListApi = () => {
  return http.get<Menu.MenuOptions[]>(`/menu/list`, {}, { loading: false });
};

// 获取按钮权限 (保留默认空实现或按需处理)
export const getAuthButtonListApi = () => {
  return Promise.resolve({ data: {} });
};

// 用户退出登录
export const logoutApi = () => {
  return Promise.resolve(); // 后端无状态JWT，前端直接清除即可
};
