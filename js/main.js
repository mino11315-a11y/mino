(function () {
    // 이 이름을 localStorage의 키로 사용합니다. 같은 브라우저에서는 새로고침 후에도 데이터가 남습니다.
    const storageKey = "subscription-tracker-data";

    // HTML에서 자주 사용할 요소를 찾아 변수에 담아 두면, 아래 코드에서 다시 찾지 않아도 됩니다.
    const form = document.getElementById("subscription-form");
    const formTitle = document.getElementById("form-title");
    const submitButton = document.getElementById("submit-button");
    const cancelButton = document.getElementById("cancel-edit");
    const list = document.getElementById("subscription-list");
    let subscriptions = [];

    // localStorage의 데이터가 현재 프로그램에서 사용할 수 있는 모양인지 확인합니다.
    // 잘못된 값이 계산 함수에 전달되어 화면이 멈추는 일을 막습니다.
    function isValidSubscription(subscription) {
        return subscription &&
            typeof subscription.id === "string" &&
            typeof subscription.name === "string" &&
            Number.isFinite(subscription.amount) &&
            subscription.amount > 0 &&
            (subscription.cycle === "monthly" || subscription.cycle === "yearly") &&
            typeof subscription.nextPaymentDate === "string" &&
            typeof subscription.category === "string";
    }

    // 브라우저에 저장된 JSON 문자열을 읽고 JavaScript 배열로 바꿉니다.
    // 아직 저장된 값이 없으면 빈 배열로 시작합니다.
    function loadSubscriptions() {
        const storedData = window.localStorage.getItem(storageKey);
        if (storedData === null) {
            return [];
        }

        const parsedData = JSON.parse(storedData);
        if (!Array.isArray(parsedData) || !parsedData.every(isValidSubscription)) {
            throw new Error("저장된 구독 데이터 형식이 올바르지 않습니다.");
        }
        return parsedData;
    }

    // 변경한 배열을 JSON 문자열로 바꾸어 저장하고, 저장에 성공하면 화면도 새로 그립니다.
    // 저장 공간이 막혔거나 가득 찬 경우 오류 메시지를 보여주고 실패를 알립니다.
    function saveSubscriptions(nextSubscriptions) {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(nextSubscriptions));
        } catch (error) {
            SubscriptionUI.showMessage("구독을 저장하지 못했습니다: " + error.message, true);
            return false;
        }

        subscriptions = nextSubscriptions;
        SubscriptionUI.render(subscriptions);
        return true;
    }

    // 입력 폼을 새 구독을 추가하는 처음 상태로 되돌립니다.
    function resetForm() {
        form.reset();
        document.getElementById("subscription-id").value = "";
        formTitle.textContent = "새 구독 추가";
        submitButton.textContent = "구독 추가";
        cancelButton.hidden = true;
    }

    // 수정 버튼을 누른 구독의 값을 폼에 채워 사용자가 편집할 수 있게 합니다.
    function startEditing(subscription) {
        document.getElementById("subscription-id").value = subscription.id;
        document.getElementById("name").value = subscription.name;
        document.getElementById("amount").value = subscription.amount;
        document.getElementById("cycle").value = subscription.cycle;
        document.getElementById("next-payment-date").value = subscription.nextPaymentDate;
        document.getElementById("category").value = subscription.category;
        formTitle.textContent = "구독 수정";
        submitButton.textContent = "수정 내용 저장";
        cancelButton.hidden = false;
        document.getElementById("name").focus();
    }

    // 폼 제출은 브라우저 기본 동작(페이지 이동/새로고침) 대신 JavaScript로 처리합니다.
    form.addEventListener("submit", function (event) {
        // 페이지가 새로고침되지 않도록 기본 제출 동작을 취소합니다.
        event.preventDefault();

        // 각 입력의 name 값을 기준으로 폼 데이터를 읽습니다.
        const formData = new FormData(form);
        const existingId = formData.get("id");

        // 입력값을 계산 함수가 사용하는 구독 객체 모양으로 정리합니다.
        // 수정이면 기존 ID를 유지하고, 추가이면 새 ID를 만듭니다.
        const subscription = {
            id: existingId || (window.crypto && window.crypto.randomUUID
                ? window.crypto.randomUUID()
                : "sub-" + Date.now() + "-" + Math.random().toString(16).slice(2)),
            name: String(formData.get("name")).trim(),
            amount: Number(formData.get("amount")),
            cycle: String(formData.get("cycle")),
            nextPaymentDate: String(formData.get("nextPaymentDate")),
            category: String(formData.get("category")).trim()
        };

        // 브라우저의 required 검사 외에도 공백 이름/카테고리와 올바르지 않은 금액을 확인합니다.
        if (!subscription.name || !subscription.category || !Number.isFinite(subscription.amount) ||
            subscription.amount <= 0 || !subscription.nextPaymentDate) {
            SubscriptionUI.showMessage("모든 항목을 올바르게 입력해 주세요.", true);
            return;
        }

        // 숨겨진 ID가 있으면 해당 구독만 교체하고, 없으면 배열 끝에 새 구독을 추가합니다.
        const nextSubscriptions = existingId
            ? subscriptions.map(function (item) {
                return item.id === existingId ? subscription : item;
            })
            : subscriptions.concat(subscription);

        // 저장에 성공한 경우에만 폼을 비우고 완료 메시지를 보여줍니다.
        if (saveSubscriptions(nextSubscriptions)) {
            resetForm();
            SubscriptionUI.showMessage(existingId ? "구독 정보를 수정했어요." : "새 구독을 추가했어요.");
        }
    });

    // 목록의 각 버튼에 개별 이벤트를 붙이는 대신, 목록 부모 하나에서 클릭을 처리합니다.
    // 이렇게 하면 ui.js가 목록을 새로 그린 뒤에도 수정/삭제 버튼이 계속 동작합니다.
    list.addEventListener("click", function (event) {
        // 클릭된 요소가 수정 또는 삭제 버튼인지 확인합니다.
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        // 버튼의 data-id와 같은 ID를 가진 구독 객체를 현재 배열에서 찾습니다.
        const subscription = subscriptions.find(function (item) {
            return item.id === button.dataset.id;
        });
        if (!subscription) {
            SubscriptionUI.showMessage("해당 구독을 찾을 수 없습니다. 목록을 새로고침해 주세요.", true);
            return;
        }

        // 수정 버튼이면 선택한 구독 정보를 폼에 채웁니다.
        if (button.dataset.action === "edit") {
            startEditing(subscription);
            return;
        }

        // 삭제는 실수 방지를 위해 확인을 받은 다음, 대상 구독만 배열에서 제외합니다.
        if (button.dataset.action === "delete" &&
            window.confirm("'" + subscription.name + "' 구독을 삭제할까요?")) {
            const nextSubscriptions = subscriptions.filter(function (item) {
                return item.id !== subscription.id;
            });
            if (saveSubscriptions(nextSubscriptions)) {
                if (document.getElementById("subscription-id").value === subscription.id) {
                    resetForm();
                }
                SubscriptionUI.showMessage("구독을 삭제했어요.");
            }
        }
    });

    // 수정 도중 취소하면 입력한 변경사항을 버리고 새 구독 입력 상태로 돌아갑니다.
    cancelButton.addEventListener("click", resetForm);

    // 첫 화면을 그리기 전에 저장 데이터를 읽습니다. JSON이 깨졌거나 읽을 수 없으면
    // 폼을 비활성화하여 기존 데이터를 덮어쓰지 않도록 하고 오류를 알립니다.
    try {
        subscriptions = loadSubscriptions();
    } catch (error) {
        form.querySelectorAll("input, select, button").forEach(function (control) {
            control.disabled = true;
        });
        SubscriptionUI.render([]);
        SubscriptionUI.showMessage("저장된 데이터를 불러오지 못했습니다. 브라우저 저장 공간을 확인해 주세요. (" +
            error.message + ")", true);
        return;
    }

    // 저장된 데이터로 요약, 목록, 카테고리 영역의 첫 화면을 표시합니다.
    SubscriptionUI.render(subscriptions);

}());
