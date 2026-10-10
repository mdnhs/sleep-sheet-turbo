"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";

interface SimpleChartData {
  name: string;
  value: number;
}

export function CustomLineChart({ data }: { data: SimpleChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="var(--secondary)" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CustomBarChart({ data }: { data: SimpleChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface CohortRow {
  cohortMonth: string;
  totalUsers: number;
  retentionRate: number;
}

export function CohortChart({ data }: { data: CohortRow[] }) {
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1 pr-3 font-medium text-muted-foreground">
              Cohort
            </th>
            <th className="text-right py-1 pr-3 font-medium text-muted-foreground">
              Users
            </th>
            <th className="text-right py-1 font-medium text-muted-foreground">
              Retention
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.cohortMonth} className="border-b last:border-0">
              <td className="py-1 pr-3">
                {new Date(row.cohortMonth).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                })}
              </td>
              <td className="text-right py-1 pr-3">
                {row.totalUsers.toLocaleString()}
              </td>
              <td className="text-right py-1">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    background: `hsl(${Math.round(row.retentionRate * 1.2)}, 70%, 90%)`,
                    color: `hsl(${Math.round(row.retentionRate * 1.2)}, 60%, 30%)`,
                  }}
                >
                  {row.retentionRate.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RevenueAnalyticsBarChart({ data, currencySymbol = "$" }: { data: SimpleChartData[]; currencySymbol?: string }) {
  const formatYAxis = (val: number) => {
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return `${val}`;
  };

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <BarChart data={data} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#888888" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickFormatter={formatYAxis}
          tick={{ fontSize: 12, fill: "#888888" }}
        />
        <Tooltip
          formatter={(value: ValueType | undefined) => [`${currencySymbol}${Number(value).toLocaleString()}`, "Revenue"]}
          cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
        />
        <Bar
          dataKey="value"
          fill="var(--secondary)"
          radius={[16, 16, 16, 16]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface ProfitLossChartData {
  name: string;
  profit: number;
  cost: number;
}

export function ProfitLossStackedChart({ data, currencySymbol = "$" }: { data: ProfitLossChartData[]; currencySymbol?: string }) {
  const formatYAxis = (val: number) => {
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return `${val}`;
  };

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <BarChart data={data} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#888888" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickFormatter={formatYAxis}
          tick={{ fontSize: 12, fill: "#888888" }}
        />
        <Tooltip
          formatter={(value: ValueType | undefined, name: NameType | undefined) => [
            `${currencySymbol}${Number(value).toLocaleString()}`,
            name === "cost" ? "Cost / Loss" : "Net Profit",
          ]}
          cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
        />
        <Bar
          dataKey="cost"
          name="cost"
          stackId="a"
          fill="#1E1E1E"
          radius={[0, 0, 8, 8]}
          maxBarSize={32}
        />
        <Bar
          dataKey="profit"
          name="profit"
          stackId="a"
          fill="var(--secondary)"
          radius={[8, 8, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
