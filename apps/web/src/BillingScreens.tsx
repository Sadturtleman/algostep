import React from "react";
import { go } from "./router.js";

/** Presentation only. Never collects payment credentials or grants review credits. */
export function BillingScreens({
  checkout,
  usage,
}: {
  checkout: boolean;
  usage: any;
}) {
  return (
    <div className="billing-page">
      <div className="page-heading">
        <span className="eyebrow">
          {checkout ? "CHECKOUT PREVIEW" : "MEMBERSHIP"}
        </span>
        <h1>
          {checkout ? "구독 결제 안내" : "배움은 무료로, 리뷰는 필요할 때"}
        </h1>
        <p>
          {checkout
            ? "상품과 결제 조건을 확인하는 화면이에요. 아직 결제할 수 없어요."
            : "개념 학습부터 코드 실행·복잡도 분석까지 무료로 이용하세요."}
        </p>
      </div>
      {checkout ? (
        <div className="checkout-layout">
          <section className="panel">
            <h2>1. 구독 상품</h2>
            <h3>Algostep 리뷰 구독</h3>
            <p>LLM이 논리 오류, 효율 개선, 대안 코드를 설명해요.</p>
            <dl className="billing-facts">
              <dt>월 구독료</dt>
              <dd>확정 전</dd>
              <dt>월 리뷰 제공량</dt>
              <dd>확정 전</dd>
              <dt>정기 결제일</dt>
              <dd>상품 출시 시 안내</dd>
              <dt>환불·해지 조건</dt>
              <dd>상품 출시 시 안내</dd>
            </dl>
            <hr />
            <h2>2. 결제 수단</h2>
            <div className="payment-placeholder">결제 수단 준비 중</div>
            <p className="caption">
              PG 연동 후 지원 수단을 안내할 예정이에요. 지금은 카드 정보나 결제
              정보를 입력받지 않아요.
            </p>
          </section>
          <aside className="panel order-summary">
            <h2>결제 내역</h2>
            <dl className="billing-facts">
              <dt>상품</dt>
              <dd>리뷰 구독</dd>
              <dt>결제 금액</dt>
              <dd>가격 미정</dd>
              <dt>현재 청구</dt>
              <dd>없음</dd>
            </dl>
            <p role="status">
              가격·제공량·약관 확정 후 신청할 수 있어요. 현재 구독 신청이나
              청구는 발생하지 않아요.
            </p>
            <button disabled>결제 준비 중</button>
            <button className="secondary" onClick={() => go("/plans")}>
              구독 안내로 돌아가기
            </button>
          </aside>
        </div>
      ) : (
        <>
          <div className="plans-grid">
            <article className="panel plan-card">
              <span className="badge">기본 이용</span>
              <h2>무료</h2>
              <p className="plan-price">
                ₩0 <small>/ 계속 무료</small>
              </p>
              <ul>
                <li>200개 개념과 시각화 학습</li>
                <li>단계별 상태 예측</li>
                <li>웹에서 코드 작성·실행</li>
                <li>시간·공간 복잡도 분석</li>
                <li>LLM 코드 리뷰 월 3건</li>
                <li>기록 저장과 PDF 내보내기</li>
              </ul>
              <button className="secondary" onClick={() => go("/learn")}>
                무료로 학습하기
              </button>
            </article>
            <article className="panel plan-card featured-plan">
              <span className="badge">출시 준비 중</span>
              <h2>리뷰 구독</h2>
              <p className="plan-price">가격 준비 중</p>
              <p>
                무료 리뷰를 모두 사용한 뒤에도 코드에 대한 설명을 받을 수 있는
                상품을 준비하고 있어요.
              </p>
              <ul>
                <li>논리 오류와 원인 설명</li>
                <li>시간·공간 효율 개선 제안</li>
                <li>대안 코드와 접근 방법</li>
              </ul>
              <p className="caption">
                가격, 월 제공량, 정기 결제 및 환불 조건은 아직 정해지지
                않았어요.
              </p>
              <button onClick={() => go("/checkout")}>
                결제 화면 미리 보기
              </button>
            </article>
          </div>
          <section className="panel billing-policy">
            <h2>무료 리뷰 이용 안내</h2>
            {usage && (
              <p>
                이번 달 남은 무료 리뷰:{" "}
                <strong>
                  {Math.max(
                    0,
                    3 - (usage.consumed ?? 0) - (usage.reserved ?? 0),
                  )}
                  건
                </strong>
              </p>
            )}
            <p>
              매월 1일 00:00 KST에 3건이 새로 제공되고, 남은 횟수는 이월되지
              않아요. 코드 작성·실행과 기본 분석에는 리뷰 횟수가 차감되지
              않아요.
            </p>
            <p>
              모바일에서는 개념과 예측 학습을 이용하고, 코드 작성과 실행은
              웹에서 진행하세요.
            </p>
            <p>현재 결제 기능은 준비 중이며 유료 구독이 활성화되지 않아요.</p>
          </section>
        </>
      )}
    </div>
  );
}
