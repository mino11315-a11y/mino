(function () {
    // 카테고리 막대에 순서대로 사용할 색상입니다. 카테고리가 색 개수보다 많으면 다시 처음 색부터 씁니다.
    const colors = ["#6558d3", "#40a89a", "#e3a33b", "#e27777", "#578acb", "#9c69bd"];

    // 구독 이름처럼 화면에 표시되는 입력값을 HTML 문자열에 넣기 전에 특수문자를 안전하게 바꿉니다.
    // 예를 들어 <, >를 문자 그대로 보여주어 입력값이 HTML 태그로 해석되지 않게 합니다.
    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;",
                "'": "&#39;"
            };
            return entities[character];
        });
    }

    // 숫자를 한국식 천 단위 구분 기호와 원 단위가 있는 문자열로 바꿉니다.
    function formatMoney(amount) {
        return Math.round(amount).toLocaleString("ko-KR") + "원";
    }

    // logic.js의 날짜 계산 함수가 기대하는 YYYY-MM-DD 형식의 오늘 날짜를 만듭니다.
    function getToday() {
        return new Date().toISOString().slice(0, 10);
    }

    // logic.js의 계산 결과를 상단 요약 카드에 표시합니다.
    // 이번 주 결제는 오늘부터 7일 이내에 예정된 구독 건수입니다.
    function renderSummary(subscriptions) {
        document.getElementById("summary-monthly").textContent =
            formatMoney(getTotalMonthlyAmount(subscriptions));
        document.getElementById("summary-yearly").textContent =
            formatMoney(getTotalAnnualAmount(subscriptions));

        const upcoming = getUpcomingPayments(subscriptions, 7);
        document.getElementById("summary-weekly").textContent = upcoming.length + "건";
        document.getElementById("summary-weekly-note").textContent = upcoming.length
            ? upcoming.map(function (subscription) {
                return subscription.name;
            }).join(", ") + " 결제 예정"
            : "앞으로 7일 이내 결제";
    }

    // 구독 배열을 카드 HTML로 바꾸어 목록 영역에 표시합니다.
    // 이름, 카테고리, 주기, 월 환산 금액, 다음 결제일까지 남은 날짜를 포함합니다.
    function renderSubscriptions(subscriptions) {
        const list = document.getElementById("subscription-list");
        const empty = document.getElementById("subscription-empty");
        const today = getToday();

        document.getElementById("subscription-count").textContent = subscriptions.length + "개";
        empty.hidden = subscriptions.length > 0;

        list.innerHTML = subscriptions.map(function (subscription) {
            // 남은 날짜를 D-숫자, 오늘이면 D-Day, 이미 지난 날이면 D+숫자로 표시합니다.
            const remainingDays = getRemainingDays(today, subscription.nextPaymentDate);
            const dueLabel = remainingDays > 0
                ? "D-" + remainingDays
                : remainingDays === 0
                    ? "D-Day"
                    : "D+" + Math.abs(remainingDays);
            const dueClass = remainingDays >= 0 && remainingDays <= 7 ? " is-soon" : "";
            const cycleLabel = subscription.cycle === "yearly" ? "매년" : "매월";
            const monthlyAmount = getMonthlyAmount(subscription);
            const initial = String(subscription.name || "?").slice(0, 1);

            // 버튼의 data-action과 data-id는 main.js가 클릭을 처리하고 구독을 찾을 때 사용합니다.
            return '<article class="subscription-card">' +
                '<div class="subscription-card-main">' +
                    '<span class="service-icon" aria-hidden="true">' + escapeHTML(initial) + '</span>' +
                    '<div class="service-details">' +
                        '<div class="service-name-line"><p class="service-name">' + escapeHTML(subscription.name) + '</p></div>' +
                        '<div class="service-meta">' +
                            '<span>' + escapeHTML(subscription.category) + '</span>' +
                            '<span class="cycle-tag">' + cycleLabel + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="subscription-card-side">' +
                    '<div class="service-price">' +
                        '<p class="monthly-price">' + formatMoney(monthlyAmount) + '<span class="service-meta"> / 월</span></p>' +
                        '<span class="due-date' + dueClass + '">' + dueLabel + ' · ' +
                            escapeHTML(subscription.nextPaymentDate) + '</span>' +
                    '</div>' +
                    '<div class="subscription-card-actions">' +
                        '<button class="text-button" type="button" data-action="edit" data-id="' + escapeHTML(subscription.id) + '">수정</button>' +
                        '<button class="text-button delete-button" type="button" data-action="delete" data-id="' + escapeHTML(subscription.id) + '">삭제</button>' +
                    '</div>' +
                '</div>' +
            '</article>';
        }).join("");
    }

    // logic.js에서 카테고리별 월 지출 합계를 얻고, 전체 월 지출에서 차지하는 비율을 막대로 표현합니다.
    function renderCategories(subscriptions) {
        const list = document.getElementById("category-list");
        const empty = document.getElementById("category-empty");
        const categories = getMonthlyAmountByCategory(subscriptions);
        const entries = Object.entries(categories).sort(function (a, b) {
            return b[1] - a[1];
        });
        const total = getTotalMonthlyAmount(subscriptions);

        // 가장 지출이 큰 카테고리가 위에 오도록 정렬합니다.
        empty.hidden = entries.length > 0;
        list.innerHTML = entries.map(function (entry, index) {
            const percentage = total === 0 ? 0 : Math.round(entry[1] / total * 100);
            const color = colors[index % colors.length];

            return '<div class="category-item">' +
                '<div class="category-row-label category-row">' +
                    '<span class="category-row-label">' +
                        '<span class="category-dot" style="--category-color:' + color + '"></span>' +
                        '<span class="category-name">' + escapeHTML(entry[0]) + '</span>' +
                    '</span>' +
                    '<span class="category-total">' + formatMoney(entry[1]) + ' · ' + percentage + '%</span>' +
                '</div>' +
                '<div class="category-track" role="img" aria-label="' + escapeHTML(entry[0]) + ' 비중 ' + percentage + '%">' +
                    '<div class="category-fill" style="width:' + percentage + '%;--category-color:' + color + '"></div>' +
                '</div>' +
            '</div>';
        }).join("");
    }

    // 데이터가 추가/수정/삭제될 때 모든 화면 영역을 같은 배열 기준으로 다시 표시합니다.
    function render(subscriptions) {
        renderSummary(subscriptions);
        renderSubscriptions(subscriptions);
        renderCategories(subscriptions);
    }

    // main.js가 화면을 그리거나 사용자 메시지를 보여줄 수 있도록 필요한 기능을 window에 공개합니다.
    window.SubscriptionUI = {
        render: render,
        showMessage: function (message, isError) {
            const element = document.getElementById("app-message");
            element.textContent = message;
            element.classList.toggle("is-error", Boolean(isError));
            element.hidden = false;

            // 이전 메시지가 사라지기 전에 새 메시지가 오면 타이머를 초기화해 마지막 메시지가 보이게 합니다.
            window.clearTimeout(element.messageTimer);
            element.messageTimer = window.setTimeout(function () {
                element.hidden = true;
            }, isError ? 6000 : 3000);
        }
    };
}());
