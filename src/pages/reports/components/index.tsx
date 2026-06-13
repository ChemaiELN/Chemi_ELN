import React from 'react';
import { Button } from 'antd';
import {
  HomeOutlined,
  FileTextOutlined,
  ProfileOutlined,
  FundOutlined,
  LineChartOutlined,
  UserOutlined,
  AuditOutlined,
  BookOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import Header from '@/common/Header';
import Sidebar from '@/common/Sidebar';
import styles from './styles.module.less';

interface ReportCard {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const reportCards: ReportCard[] = [
  {
    id: 1,
    icon: <FileTextOutlined />,
    title: 'Experiment Summary Report',
    description:
      'Complete summary of experiments with status, yield data, and contributor information',
  },
  {
    id: 2,
    icon: <ProfileOutlined />,
    title: 'ATR Status Report',
    description:
      'Analytical test request status across experiments and projects',
  },
  {
    id: 3,
    icon: <FundOutlined />,
    title: 'Project Progress Report',
    description:
      'Project-level progress with notebook and experiment counts',
  },
  {
    id: 4,
    icon: <LineChartOutlined />,
    title: 'Yield Analysis Report',
    description:
      'Statistical yield analysis across routes and stages with trends',
  },
  {
    id: 5,
    icon: <UserOutlined />,
    title: 'User Activity Report',
    description:
      'Login history, actions performed, and audit trail per user',
  },
  {
    id: 6,
    icon: <AuditOutlined />,
    title: 'Compliance Audit Report',
    description:
      'Full audit trail for 21 CFR Part 11 compliance verification',
  },
  {
    id: 7,
    icon: <BookOutlined />,
    title: 'Notebook Summary Report',
    description:
      'Notebook counts, status distribution, and experiment timelines',
  },
  {
    id: 8,
    icon: <MedicineBoxOutlined />,
    title: 'Experiment Health Report',
    description:
      'Experiments flagged by health thresholds with recommended actions',
  },
];

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="application" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <span
              className={styles.breadcrumbHome}
              onClick={() => navigate('/dashboard')}
            >
              <HomeOutlined /> Home
            </span>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Reports</span>
          </div>

          {/* Page Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Chemia Reports</h1>
            <p className={styles.pageSubtitle}>
              Generate and export comprehensive reports from all modules
            </p>
          </div>

          {/* Report Cards Grid */}
          <div className={styles.grid}>
            {reportCards.map((card) => (
              <div key={card.id} className={styles.card}>
                <div className={styles.cardIcon}>{card.icon}</div>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardDescription}>{card.description}</p>
                <Button className={styles.generateBtn}>Generate</Button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReportsPage;
