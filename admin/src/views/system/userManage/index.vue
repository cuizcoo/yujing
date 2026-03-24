<template>
  <div class="table-box">
    <!-- 搜索区域 -->
    <el-card class="search-box" shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="手机号">
          <el-input v-model="searchForm.phone" placeholder="请输入手机号" clearable></el-input>
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="searchForm.name" placeholder="请输入姓名" clearable></el-input>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="searchForm.roleId" placeholder="请选择角色" clearable style="width: 150px">
            <el-option v-for="item in roleOptions" :key="item.id" :label="item.roleName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格区域 -->
    <el-card class="table-main" shadow="never">
      <div class="table-header">
        <el-button type="primary" @click="openDialog('add')">新增用户</el-button>
        <el-button type="danger" :disabled="!selectedIds.length" @click="batchDelete">批量删除</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" @selection-change="handleSelectionChange" border>
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column prop="id" label="用户ID" width="80" align="center" />
        <el-table-column prop="phone" label="登录手机号" width="120" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
              {{ scope.row.status === 1 ? "启用" : "禁用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="roleIds" label="所属角色" min-width="150">
          <template #default="scope">
            <el-tag v-for="rid in scope.row.roleIds" :key="rid" style="margin-right: 4px" type="info">
              {{ getRoleName(rid) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160">
          <template #default="scope">{{ formatDate(scope.row.createTime) }}</template>
        </el-table-column>
        <el-table-column prop="lastLoginTime" label="最后登录" width="160">
          <template #default="scope">{{ formatDate(scope.row.lastLoginTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="openDialog('edit', scope.row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete([scope.row.id])">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="pageable.pageNum"
          v-model:page-size="pageable.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pageable.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchData"
          @current-change="fetchData"
        />
      </div>
    </el-card>

    <!-- 弹窗 -->
    <el-dialog :title="dialogType === 'add' ? '新增用户' : '编辑用户'" v-model="dialogVisible" width="550px" @close="resetForm">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入11位手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="formData.name" placeholder="2-20个中英文字符" maxlength="20" />
        </el-form-item>
        <el-form-item label="密码" prop="password" :rules="dialogType === 'add' ? rules.password : [{ required: false }]">
          <el-input v-model="formData.password" type="password" placeholder="6-20位字母和数字" show-password />
        </el-form-item>
        <el-form-item
          label="确认密码"
          prop="confirmPassword"
          :rules="dialogType === 'add' || formData.password ? rules.confirmPassword : [{ required: false }]"
        >
          <el-input v-model="formData.confirmPassword" type="password" placeholder="请再次输入密码" show-password />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch v-model="formData.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="所属角色" prop="roleIds">
          <el-select v-model="formData.roleIds" multiple placeholder="请选择角色" style="width: 100%">
            <el-option v-for="item in roleOptions" :key="item.id" :label="item.roleName" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="userManage">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import http from "@/api";
import dayjs from "dayjs";

const searchForm = reactive({ phone: "", name: "", status: "", roleId: "" });
const tableData = ref([]);
const roleOptions = ref<any[]>([]);
const loading = ref(false);
const pageable = reactive({ pageNum: 1, pageSize: 20, total: 0 });
const selectedIds = ref<number[]>([]);

const dialogVisible = ref(false);
const dialogType = ref<"add" | "edit">("add");
const formRef = ref<FormInstance>();
const formData = reactive({
  id: undefined,
  phone: "",
  name: "",
  password: "",
  confirmPassword: "",
  status: 1,
  roleIds: [] as number[]
});

// 验证器
const validatePhone = (rule: any, value: any, callback: any) => {
  if (!/^1[3-9]\d{9}$/.test(value)) {
    callback(new Error("请输入正确的手机号格式"));
  } else {
    callback();
  }
};
const validateName = (rule: any, value: any, callback: any) => {
  if (!/^[\u4e00-\u9fa5a-zA-Z]{2,20}$/.test(value)) {
    callback(new Error("请输入2-20个中英文字符"));
  } else {
    callback();
  }
};
const validatePassword = (rule: any, value: any, callback: any) => {
  if (dialogType.value === "edit" && !value) {
    callback();
  } else if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{6,20}$/.test(value)) {
    callback(new Error("密码需包含字母和数字，长度6-20位"));
  } else {
    if (formData.confirmPassword !== "") {
      formRef.value?.validateField("confirmPassword");
    }
    callback();
  }
};
const validateConfirmPassword = (rule: any, value: any, callback: any) => {
  if (dialogType.value === "edit" && !formData.password && !value) {
    callback();
  } else if (value !== formData.password) {
    callback(new Error("两次输入密码不一致!"));
  } else {
    callback();
  }
};

const rules = reactive<FormRules>({
  phone: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    { validator: validatePhone, trigger: "blur" }
  ],
  name: [
    { required: true, message: "请输入姓名", trigger: "blur" },
    { validator: validateName, trigger: "blur" }
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { validator: validatePassword, trigger: "blur" }
  ],
  confirmPassword: [
    { required: true, message: "请确认密码", trigger: "blur" },
    { validator: validateConfirmPassword, trigger: "blur" }
  ],
  status: [{ required: true, message: "请选择状态", trigger: "change" }],
  roleIds: [{ type: "array", required: true, message: "请至少选择一个角色", trigger: "change" }]
});

const formatDate = (dateStr: string) => (dateStr ? dayjs(dateStr).format("YYYY-MM-DD HH:mm:ss") : "-");

const getRoleName = (roleId: number) => {
  const role = roleOptions.value.find(r => r.id === roleId);
  return role ? role.roleName : "未知角色";
};

const fetchRoles = async () => {
  const res = await http.get<any>("/system/role/list", { pageNum: 1, pageSize: 999 });
  if (Number(res.code) === 200) {
    roleOptions.value = res.data.list;
  }
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await http.get<any>("/system/user/list", { ...searchForm, ...pageable });
    if (Number(res.code) === 200) {
      tableData.value = res.data.list;
      pageable.total = res.data.total;
    }
  } finally {
    loading.value = false;
  }
};

const resetSearch = () => {
  Object.assign(searchForm, { phone: "", name: "", status: "", roleId: "" });
  pageable.pageNum = 1;
  fetchData();
};

const handleSelectionChange = (val: any[]) => {
  selectedIds.value = val.map(item => item.id);
};

const openDialog = (type: "add" | "edit", row?: any) => {
  dialogType.value = type;
  if (type === "edit" && row) {
    Object.assign(formData, { ...row, password: "", confirmPassword: "" });
  } else {
    Object.assign(formData, { id: undefined, phone: "", name: "", password: "", confirmPassword: "", status: 1, roleIds: [] });
  }
  dialogVisible.value = true;
};

const resetForm = () => {
  formRef.value?.resetFields();
};

const submitForm = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async valid => {
    if (valid) {
      const url = dialogType.value === "add" ? "/system/user/add" : "/system/user/update";
      const method = dialogType.value === "add" ? "post" : "put";
      const res = await http[method]<any>(url, formData);
      if (Number(res.code) === 200) {
        ElMessage.success(`${dialogType.value === "add" ? "新增" : "编辑"}成功`);
        dialogVisible.value = false;
        fetchData();
      }
    }
  });
};

const handleDelete = (ids: number[]) => {
  ElMessageBox.confirm("确认删除已选中的用户吗？此操作将保留历史记录。", "危险操作", { type: "error" })
    .then(async () => {
      const res = await http.delete<any>("/system/user/delete", {}, { data: { ids } });
      if (Number(res.code) === 200) {
        ElMessage.success("删除成功");
        fetchData();
      }
    })
    .catch(() => {
      // cancel
    });
};

const batchDelete = () => {
  if (!selectedIds.value.length) return;
  handleDelete(selectedIds.value);
};

onMounted(() => {
  fetchRoles();
  fetchData();
});
</script>

<style scoped>
.table-box {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}
.search-box {
  margin-bottom: 0;
}
.table-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.table-header {
  margin-bottom: 16px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
