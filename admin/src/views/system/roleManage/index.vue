<template>
  <div class="table-box">
    <!-- 搜索区域 -->
    <el-card class="search-box" shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="角色名称">
          <el-input v-model="searchForm.roleName" placeholder="请输入角色名称" clearable></el-input>
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            clearable
          />
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
        <el-button type="primary" @click="openDialog('add')">新增角色</el-button>
        <el-button type="danger" :disabled="!selectedIds.length" @click="batchDelete">批量删除</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" @selection-change="handleSelectionChange" border>
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column prop="id" label="角色ID" width="80" align="center" />
        <el-table-column prop="roleName" label="角色名称" />
        <el-table-column prop="roleDesc" label="角色描述" show-overflow-tooltip />
        <el-table-column prop="createTime" label="创建时间" width="180">
          <template #default="scope">{{ formatDate(scope.row.createTime) }}</template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="180">
          <template #default="scope">{{ formatDate(scope.row.updateTime) }}</template>
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
    <el-dialog :title="dialogType === 'add' ? '新增角色' : '编辑角色'" v-model="dialogVisible" width="500px" @close="resetForm">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-form-item label="角色名称" prop="roleName">
          <el-input v-model="formData.roleName" placeholder="2-20个字符" maxlength="20" />
        </el-form-item>
        <el-form-item label="角色描述" prop="roleDesc">
          <el-input v-model="formData.roleDesc" type="textarea" placeholder="0-200个字符" maxlength="200" />
        </el-form-item>
        <el-form-item label="角色权限" prop="permissions">
          <el-checkbox-group v-model="formData.permissions">
            <el-checkbox label="home">首页</el-checkbox>
            <el-checkbox label="pressure-well">减压井状态诊断</el-checkbox>
            <el-checkbox label="system">权限管理</el-checkbox>
            <el-checkbox label="roleManage">角色管理</el-checkbox>
            <el-checkbox label="userManage">用户管理</el-checkbox>
          </el-checkbox-group>
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

<script setup lang="ts" name="roleManage">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import http from "@/api";
import dayjs from "dayjs";

const searchForm = reactive({ roleName: "", dateRange: [] as string[] });
const tableData = ref([]);
const loading = ref(false);
const pageable = reactive({ pageNum: 1, pageSize: 20, total: 0 });
const selectedIds = ref<number[]>([]);

const dialogVisible = ref(false);
const dialogType = ref<"add" | "edit">("add");
const formRef = ref<FormInstance>();
const formData = reactive({
  id: undefined,
  roleName: "",
  roleDesc: "",
  permissions: [] as string[]
});

const rules = reactive<FormRules>({
  roleName: [
    { required: true, message: "请输入角色名称", trigger: "blur" },
    { min: 2, max: 20, message: "长度在 2 到 20 个字符", trigger: "blur" }
  ],
  permissions: [{ type: "array", required: true, message: "请至少选择一个权限", trigger: "change" }]
});

const formatDate = (dateStr: string) => (dateStr ? dayjs(dateStr).format("YYYY-MM-DD HH:mm:ss") : "-");

const fetchData = async () => {
  loading.value = true;
  try {
    const params: any = { roleName: searchForm.roleName, ...pageable };
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      params.startTime = searchForm.dateRange[0] + " 00:00:00";
      params.endTime = searchForm.dateRange[1] + " 23:59:59";
    }
    const res = await http.get<any>("/system/role/list", params);
    if (Number(res.code) === 200) {
      tableData.value = res.data.list;
      pageable.total = res.data.total;
    }
  } finally {
    loading.value = false;
  }
};

const resetSearch = () => {
  searchForm.roleName = "";
  searchForm.dateRange = [];
  pageable.pageNum = 1;
  fetchData();
};

const handleSelectionChange = (val: any[]) => {
  selectedIds.value = val.map(item => item.id);
};

const openDialog = (type: "add" | "edit", row?: any) => {
  dialogType.value = type;
  if (type === "edit" && row) {
    Object.assign(formData, { ...row });
  } else {
    Object.assign(formData, { id: undefined, roleName: "", roleDesc: "", permissions: [] });
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
      const url = dialogType.value === "add" ? "/system/role/add" : "/system/role/update";
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
  ElMessageBox.confirm("确认删除已选中的角色吗？如果角色下有关联用户将无法删除。", "提示", { type: "warning" })
    .then(async () => {
      const res = await http.delete("/system/role/delete", {}, { data: { ids } });
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
