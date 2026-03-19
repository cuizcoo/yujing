<template>
  <div class="app-container">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <h1 class="title">减压井淤堵状态智能诊断系统</h1>
        <!-- <span class="role-badge client">
          普通客户
        </span> -->
      </div>
      <!-- 暂时隐藏权限切换按钮
      <div class="header-right">
        <button class="toggle-role-btn" @click="toggleRole">
          切换权限
        </button>
      </div>
      -->
    </header>

    <main class="main-content">
      <!-- Info Card -->
      <section class="card info-card">
        <div class="card-header">
          <h3>诊断说明</h3>
        </div>
        <div class="card-body">
          <p>
            外江水位越高，减压井流量越大。但在相同外江水位下，随着使用年限增加，减压井流量逐渐下降（即出现<strong>淤堵</strong>现象）。
            当衰减率超过阈值时，系统将触发自动预警。
          </p>
        </div>
      </section>

      <!-- Tabs -->
      <div class="tabs">
        <button 
          class="tab-btn" 
          :class="{ active: currentTab === 'flow' }" 
          @click="currentTab = 'flow'"
        >
          流量分析
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: currentTab === 'pressure' }" 
          @click="currentTab = 'pressure'"
        >
          水压关系
        </button>
      </div>

      <!-- Chart Section (Flow) -->
      <section class="card chart-card" v-if="currentTab === 'flow'">
        <div class="card-header">
          <h3>基于流量的减压井淤堵状态预警曲线（H-Q）</h3>
        </div>
        <div class="card-body chart-wrapper">
          <v-chart class="chart" :option="chartOption" autoresize />
        </div>
      </section>

      <!-- Chart Section (Pressure) -->
      <section class="card chart-card" v-if="currentTab === 'pressure'">
        <div class="card-header">
          <h3>汛期外江水位与减压井内水压关系曲线（H-p）</h3>
        </div>
        <div class="card-body chart-wrapper">
          <v-chart class="chart" :option="pressureChartOption" autoresize />
        </div>
      </section>

      <!-- Data Table Section (所有人可见) -->
      <section class="card table-card">
        <div class="card-header table-header">
          <h3>{{ currentTab === 'flow' ? '流量监测数据' : '水压监测数据' }}</h3>
          <button @click="downloadCSV" class="download-btn">
            <svg class="icon" viewBox="0 0 1024 1024" width="14" height="14">
              <path d="M512 666.24l-236.16-236.16 60.16-60.16L469.12 502.4V128h85.76v374.4l133.12-132.48 60.16 60.16zM212.48 810.88h599.04v85.76H212.48z" fill="currentColor"></path>
            </svg>
            <span>下载数据报表</span>
          </button>
        </div>
        <div class="card-body table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ currentTab === 'flow' ? '外江水位(m)' : '江水位(m)' }}</th>
                <th>{{ currentTab === 'flow' ? '第1年流量' : '第1年水压(cm)' }}</th>
                <th>{{ currentTab === 'flow' ? '第3年流量' : '第3年水压(cm)' }}</th>
                <th>{{ currentTab === 'flow' ? '第i年流量' : '第i年水压(cm)' }}</th>
                <th>{{ currentTab === 'flow' ? '流量衰减量' : '水压衰减量' }}</th>
                <th>{{ currentTab === 'flow' ? '衰减率 (%)' : 'iHp (%)' }}</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in dataList" :key="index">
                <td>{{ item.waterLevel }}</td>
                <td>{{ currentTab === 'flow' ? item.year1 : item.year1 / 10 }}</td>
                <td>{{ currentTab === 'flow' ? item.year3 : item.year3 / 10 }}</td>
                <td>{{ currentTab === 'flow' ? item.yearI : item.yearI / 10 }}</td>
                <td class="text-danger">{{ currentTab === 'flow' ? item.decay : (item.decay / 10).toFixed(1) }}</td>
                <td class="text-danger">{{ (item.decayRate * 100).toFixed(1) }}%</td>
                <td>
                  <span class="status-badge" :class="item.decayRate >= 0.25 ? 'warning' : 'normal'">
                    {{ item.decayRate >= 0.25 ? '预警' : '正常' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      
      <!-- Removed Empty State for Client as table is now visible to all -->
    </main>
  </div>
</template>

<script setup>
import { ref, computed, provide } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, TitleComponent, LegendComponent, DataZoomComponent } from 'echarts/components';
import VChart, { THEME_KEY } from 'vue-echarts';

// Register ECharts components
use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  DataZoomComponent
]);

provide(THEME_KEY, 'light');

// Mock Data from parsed CSV
const dataList = ref([
  { waterLevel: 1, year1: 5, year3: 4, yearI: 3, decay: 2, decayRate: 0.4 },
  { waterLevel: 2, year1: 7, year3: 6, yearI: 5, decay: 2, decayRate: 0.2857 },
  { waterLevel: 3, year1: 8, year3: 8, yearI: 7, decay: 1, decayRate: 0.125 },
  { waterLevel: 4, year1: 10, year3: 9, yearI: 8, decay: 2, decayRate: 0.2 },
  { waterLevel: 5, year1: 15, year3: 13, yearI: 11, decay: 4, decayRate: 0.2667 },
  { waterLevel: 6, year1: 20, year3: 18, yearI: 16, decay: 4, decayRate: 0.2 },
  { waterLevel: 7, year1: 25, year3: 24, yearI: 19, decay: 6, decayRate: 0.24 },
  { waterLevel: 8, year1: 30, year3: 28, yearI: 23, decay: 7, decayRate: 0.2333 },
  { waterLevel: 9, year1: 36, year3: 35, yearI: 26, decay: 10, decayRate: 0.2778 },
  { waterLevel: 10, year1: 40, year3: 38, yearI: 30, decay: 10, decayRate: 0.25 }
]);

// User Role Management (暂时固定为客户)
const userRole = ref('client'); // 'admin' or 'client'
const currentTab = ref('flow'); // 'flow' or 'pressure'
const toggleRole = () => {
  userRole.value = userRole.value === 'admin' ? 'client' : 'admin';
};

// ECharts Configuration
const chartOption = computed(() => {
  const xAxisData = dataList.value.map(item => item.waterLevel);
  const year1Data = dataList.value.map(item => item.year1);
  const year3Data = dataList.value.map(item => item.year3);
  const yearIData = dataList.value.map(item => item.yearI);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: function (params) {
        // params[0]通常是第一个系列的数据（比如第1年），这里我们通过 x 轴的值（外江水位）反查 dataList 找到对应的数据项
        if (params.length === 0) return '';
        
        const waterLevel = params[0].name;
        const currentData = dataList.value.find(item => item.waterLevel == waterLevel);
        
        let tooltipStr = `<div style="font-weight:bold;margin-bottom:4px;">外江水位: ${waterLevel}m</div>`;
        
        // 渲染每条曲线的名称和数值
        params.forEach(param => {
          tooltipStr += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
        });
        
        // 如果找到了对应的数据项，展示额外的淤堵状态信息
        if (currentData) {
          const ihqPercent = (currentData.decayRate * 100).toFixed(1);
          
          // 根据需求定义预警级别逻辑
          let warningLevelStr = '';
          let warningColor = '';
          if (currentData.decayRate < 0.20) {
            warningLevelStr = '正常';
            warningColor = '#67c23a'; // 绿色
          } else if (currentData.decayRate >= 0.20 && currentData.decayRate <= 0.30) {
            warningLevelStr = '预警级别2 轻度淤堵';
            warningColor = '#e6a23c'; // 橙色
          } else {
            warningLevelStr = '预警级别1 严重淤堵';
            warningColor = '#f56c6c'; // 红色
          }

          tooltipStr += `<div style="margin-top:8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top:4px;">`;
          tooltipStr += `<div>iHQ = ${ihqPercent}%</div>`;
          tooltipStr += `<div style="color: ${warningColor}; font-weight: bold;">${warningLevelStr}</div>`;
          tooltipStr += `</div>`;
        }
        
        return tooltipStr;
      }
    },
    legend: {
      data: ['第1年流量', '第3年流量', '第i年流量'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      name: '外江水位(m)',
      nameLocation: 'middle',
      nameGap: 25,
      boundaryGap: false,
      data: xAxisData
    },
    yAxis: {
      type: 'value',
      name: '减压井流量',
      axisLabel: {
        formatter: '{value}'
      }
    },
    series: [
      {
        name: '第1年流量',
        type: 'line',
        smooth: true,
        data: year1Data,
        itemStyle: { color: '#409eff' }
      },
      {
        name: '第3年流量',
        type: 'line',
        smooth: true,
        data: year3Data,
        itemStyle: { color: '#e6a23c' }
      },
      {
        name: '第i年流量',
        type: 'line',
        smooth: true,
        data: yearIData,
        itemStyle: { color: '#f56c6c' }
      }
    ]
  };
});

// Pressure Chart Configuration
const pressureChartOption = computed(() => {
  // 从 dataList 中提取流量数据，并除以 10 得到水压数据 (根据提供的 data.csv 规律)
  const xAxisData = dataList.value.map(item => item.waterLevel);
  const year1Data = dataList.value.map(item => item.year1 / 10);
  const year3Data = dataList.value.map(item => item.year3 / 10);
  const yearIData = dataList.value.map(item => item.yearI / 10);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: function (params) {
        if (params.length === 0) return '';
        
        const waterLevel = params[0].name;
        const currentData = dataList.value.find(item => item.waterLevel == waterLevel);
        
        let tooltipStr = `<div style="font-weight:bold;margin-bottom:4px;">外江水位: ${waterLevel}m</div>`;
        
        params.forEach(param => {
          tooltipStr += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
        });
        
        if (currentData) {
          const iHpPercent = (currentData.decayRate * 100).toFixed(1);
          
          let warningLevelStr = '';
          let warningColor = '';
          if (currentData.decayRate < 0.20) {
            warningLevelStr = '正常';
            warningColor = '#67c23a';
          } else if (currentData.decayRate >= 0.20 && currentData.decayRate <= 0.30) {
            warningLevelStr = '预警级别2 轻度淤堵';
            warningColor = '#e6a23c';
          } else {
            warningLevelStr = '预警级别1 严重淤堵';
            warningColor = '#f56c6c';
          }

          tooltipStr += `<div style="margin-top:8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top:4px;">`;
          tooltipStr += `<div>iHp = ${iHpPercent}%</div>`; // 显示为 iHp
          tooltipStr += `<div style="color: ${warningColor}; font-weight: bold;">${warningLevelStr}</div>`;
          tooltipStr += `</div>`;
        }
        
        return tooltipStr;
      }
    },
    legend: {
      data: ['第1年', '第3年', '第i年'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      name: '江水位(m)',
      nameLocation: 'middle',
      nameGap: 25,
      boundaryGap: false,
      data: xAxisData
    },
    yAxis: {
      type: 'value',
      name: '水压力(cm)',
      axisLabel: {
        formatter: '{value}'
      }
    },
    series: [
      {
        name: '第1年',
        type: 'line',
        smooth: true,
        data: year1Data,
        itemStyle: { color: '#00b050' }, // 绿色
        symbolSize: 8
      },
      {
        name: '第3年',
        type: 'line',
        smooth: true,
        data: year3Data,
        itemStyle: { color: '#7030a0' }, // 紫色
        symbolSize: 8
      },
      {
        name: '第i年',
        type: 'line',
        smooth: true,
        data: yearIData,
        itemStyle: { color: '#ffc000' }, // 黄色
        symbolSize: 8
      }
    ]
  };
});

// CSV Download Logic
const downloadCSV = () => {
  let csvContent = '\uFEFF'; // BOM for Chinese characters in Excel
  csvContent += '外江水位(m),第1年流量,第3年流量,第i年流量,流量衰减量,衰减率(%)\n';

  dataList.value.forEach(item => {
    const rate = (item.decayRate * 100).toFixed(1) + '%';
    csvContent += `${item.waterLevel},${item.year1},${item.year3},${item.yearI},${item.decay},${rate}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', '减压井监测及淤堵分析数据.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
/* Reset & Base Variables */
.app-container {
  min-height: 100vh;
  background-color: #f0f2f5;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* Header */
.header {
  background-color: #fff;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.role-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.role-badge.admin { background-color: #e1f3d8; color: #67c23a; }
.role-badge.client { background-color: #f4f4f5; color: #909399; }

.toggle-role-btn {
  background: #409eff;
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.toggle-role-btn:hover { opacity: 0.8; }

/* Main Layout */
.main-content {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Tabs */
.tabs {
  background-color: #fff;
  padding: 4px;
  border-radius: 8px;
  display: flex;
  width: fit-content;
  margin: 0 auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.tab-btn {
  padding: 8px 24px;
  border: none;
  background: transparent;
  color: #606266;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s;
}

.tab-btn.active {
  background-color: #409eff;
  color: #fff;
  box-shadow: 0 2px 6px rgba(64,158,255,0.2);
}

/* Card Component */
.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  overflow: hidden;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}
.card-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.card-body {
  padding: 20px;
}

.info-card p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
}

/* Chart */
.chart-wrapper {
  height: 350px;
  padding: 10px;
}
.chart {
  width: 100%;
  height: 100%;
}

/* Table */
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #67c23a;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.download-btn:hover { background-color: #85ce61; }

.table-wrapper {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.data-table th, .data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #ebeef5;
}
.data-table th {
  background-color: #fafafa;
  color: #909399;
  font-weight: 500;
  white-space: nowrap;
}
.data-table tbody tr:hover {
  background-color: #f5f7fa;
}

/* Utilities */
.text-danger { color: #f56c6c; font-weight: 500; }
.text-center { text-align: center; }
.hint-text { color: #909399; font-size: 14px; }

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.status-badge.normal { background-color: #f0f9eb; color: #67c23a; }
.status-badge.warning { background-color: #fef0f0; color: #f56c6c; }

/* Responsive adjustments */
@media (max-width: 768px) {
  .header { padding: 12px 16px; }
  .title { font-size: 16px; }
  .main-content { padding: 12px; gap: 12px; }
  .card-body { padding: 12px; }
  .chart-wrapper { height: 280px; }
  .data-table th, .data-table td { padding: 10px 8px; font-size: 13px; }
  .download-btn span { display: none; } /* Hide text on small screens, show icon */
}
</style>
