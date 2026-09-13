// seed-roadmap.js
// 전체_로드맵_var2.md 내용을 기반으로 플랜두씨 다이어리 앱에 계획/할 일을 자동 등록합니다.
// 사용법:
//   1) 한 터미널에서 서버 실행: node server.js  (http://localhost:3000)
//   2) 다른 터미널에서 이 파일을 plan-do-see 폴더 안에 넣고: node seed-roadmap.js

const BASE = 'http://localhost:3000';

const plans = [
  {
    title: '1단계 - 네트워크 기초',
    period_start: '2026-09-11',
    period_end: '2026-10-09',
    priority: 'high',
    estimated_hours: 80,
    success_criteria: 'OSI 7계층·서브넷팅·라우팅/스위칭 개념 설명 가능 + GNS3 장애 시나리오 해결 기록 3건 이상',
    todos: [
      { title: 'TCP/IP·OSI 7계층 이론 정리', due_date: '2026-09-18', priority: 'high', tag: '이론', estimated_hours: 8 },
      { title: 'IP주소·서브네팅 실습', due_date: '2026-09-22', priority: 'high', tag: '실습', estimated_hours: 10 },
      { title: 'GNS3 설치 및 기본 토폴로지 구축', due_date: '2026-09-25', priority: 'mid', tag: '실습', estimated_hours: 6 },
      { title: 'VLAN/Trunk/STP 실습', due_date: '2026-09-29', priority: 'high', tag: '실습', estimated_hours: 10 },
      { title: 'OSPF/RIP 라우팅 실습', due_date: '2026-10-02', priority: 'high', tag: '실습', estimated_hours: 10 },
      { title: '네트워크관리사 2급 필기 접수하기', due_date: '2026-10-02', priority: 'high', tag: '자격증', estimated_hours: 1 },
      { title: '장애 시나리오 만들고 원인분석 기록 → GitHub 업로드', due_date: '2026-10-09', priority: 'mid', tag: '포트폴리오', estimated_hours: 8 },
    ],
  },
  {
    title: '2단계 - Linux 서버',
    period_start: '2026-09-25',
    period_end: '2026-10-23',
    priority: 'high',
    estimated_hours: 70,
    success_criteria: '리눅스 파일시스템·권한·SSH·서비스·방화벽 설정을 직접 서버에서 구성하고 설명 가능',
    todos: [
      { title: '파일시스템·사용자/그룹/권한 학습', due_date: '2026-09-30', priority: 'mid', tag: '이론', estimated_hours: 8 },
      { title: 'SSH 원격 접속 환경 구성', due_date: '2026-10-04', priority: 'high', tag: '실습', estimated_hours: 6 },
      { title: '프로세스·서비스·로그 관리 실습', due_date: '2026-10-09', priority: 'mid', tag: '실습', estimated_hours: 8 },
      { title: '방화벽(iptables/firewalld) 설정 실습', due_date: '2026-10-14', priority: 'high', tag: '실습', estimated_hours: 8 },
      { title: '리눅스마스터 2급 필기 접수하기', due_date: '2026-10-16', priority: 'high', tag: '자격증', estimated_hours: 1 },
      { title: '백업 스크립트 작성 및 테스트', due_date: '2026-10-20', priority: 'mid', tag: '실습', estimated_hours: 6 },
      { title: 'Windows Server 기초 훑어보기', due_date: '2026-10-23', priority: 'low', tag: '이론', estimated_hours: 5 },
    ],
  },
  {
    title: '3단계 - Python + SQL 기초',
    period_start: '2026-10-09',
    period_end: '2026-10-30',
    priority: 'mid',
    estimated_hours: 50,
    success_criteria: 'Python 기본 문법으로 간단한 스크립트 작성 + SQL JOIN/GROUP BY 활용한 조회 쿼리 작성 가능',
    todos: [
      { title: 'Python 변수·조건문·반복문', due_date: '2026-10-14', priority: 'high', tag: '이론', estimated_hours: 6 },
      { title: 'Python 함수·파일처리·예외처리', due_date: '2026-10-18', priority: 'high', tag: '실습', estimated_hours: 8 },
      { title: 'SQL SELECT/WHERE/JOIN 실습', due_date: '2026-10-23', priority: 'mid', tag: '실습', estimated_hours: 6 },
      { title: 'SQL GROUP BY/서브쿼리/집계함수 실습', due_date: '2026-10-27', priority: 'mid', tag: '실습', estimated_hours: 6 },
      { title: '미니 프로젝트: CSV → Python → SQLite 저장', due_date: '2026-10-30', priority: 'high', tag: '포트폴리오', estimated_hours: 8 },
    ],
  },
  {
    title: '4단계 - 네트워크 보안 핵심 기술',
    period_start: '2026-10-23',
    period_end: '2026-11-20',
    priority: 'high',
    estimated_hours: 60,
    success_criteria: '방화벽 정책 설계·ACL 적용·VPN 구성 원리 설명 + 트래픽 로그 정상/비정상 판단 가능',
    todos: [
      { title: '방화벽 정책 설계(허용/차단 규칙, ACL)', due_date: '2026-10-29', priority: 'high', tag: '이론', estimated_hours: 8 },
      { title: 'NAT·VPN(원격접속/Site-to-Site) 실습', due_date: '2026-11-05', priority: 'high', tag: '실습', estimated_hours: 10 },
      { title: 'IDS/IPS 개념 및 시나리오 학습', due_date: '2026-11-10', priority: 'mid', tag: '이론', estimated_hours: 6 },
      { title: '네트워크 로그 분석 연습(정상/비정상 트래픽 판단)', due_date: '2026-11-15', priority: 'high', tag: '실습', estimated_hours: 8 },
      { title: '정보보안산업기사 다음 회차 일정 큐넷에서 확인', due_date: '2026-11-20', priority: 'mid', tag: '자격증', estimated_hours: 2 },
    ],
  },
  {
    title: '5단계 - 실전 포트폴리오 프로젝트',
    period_start: '2026-11-13',
    period_end: '2027-01-15',
    priority: 'high',
    estimated_hours: 120,
    success_criteria: '네트워크 인프라·Linux 서버 운영·보안 로그 분석 3개 프로젝트를 GitHub 포트폴리오로 완성, 각 프로젝트 자소서 설명 문단 작성',
    todos: [
      { title: '프로젝트1: 네트워크 인프라 토폴로지 설계·구현(VLAN/OSPF/RIP/NAT/ACL/DHCP/DNS)', due_date: '2026-12-04', priority: 'high', tag: '프로젝트', estimated_hours: 30 },
      { title: '프로젝트2: Linux 서버 직접 구축·운영(edushare 등)', due_date: '2026-12-18', priority: 'high', tag: '프로젝트', estimated_hours: 25 },
      { title: '프로젝트3: 보안 로그 분석 파이프라인(수집→Python분석→이상탐지→DB저장→시각화)', due_date: '2027-01-08', priority: 'high', tag: '프로젝트', estimated_hours: 35 },
      { title: '3개 프로젝트 GitHub 정리 + 자소서용 설명 문단 작성', due_date: '2027-01-15', priority: 'high', tag: '포트폴리오', estimated_hours: 15 },
    ],
  },
];

async function main() {
  for (const plan of plans) {
    const { todos, ...planBody } = plan;
    const res = await fetch(`${BASE}/api/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planBody),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[실패] 계획 "${plan.title}" 생성 실패:`, err.error || res.status);
      continue;
    }
    const created = await res.json();
    console.log(`[생성] 계획: ${plan.title} (id=${created.id})`);

    for (const todo of todos) {
      const tRes = await fetch(`${BASE}/api/plans/${created.id}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todo),
      });
      if (!tRes.ok) {
        const err = await tRes.json().catch(() => ({}));
        console.error(`  [실패] 할 일 "${todo.title}":`, err.error || tRes.status);
      } else {
        console.log(`  [생성] 할 일: ${todo.title} (마감 ${todo.due_date})`);
      }
    }
  }
  console.log('\n완료! http://localhost:3000 에서 확인하세요.');
}

main().catch((e) => {
  console.error('서버에 연결할 수 없습니다. node server.js 로 서버가 먼저 실행 중인지 확인하세요.');
  console.error(e.message);
});
