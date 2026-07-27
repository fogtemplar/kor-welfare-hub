import { ConfirmDialog } from "@toss/tds-mobile";

export default function TdsExternalDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open
      title={<ConfirmDialog.Title>공식 기관 페이지로 이동할까요?</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>
          나라가쏜다를 벗어나 외부 브라우저가 열려요. 신청 조건과 접수 일정은 공식 페이지에서 최종 확인해 주세요.
        </ConfirmDialog.Description>
      }
      cancelButton={<ConfirmDialog.CancelButton onClick={onCancel}>취소</ConfirmDialog.CancelButton>}
      confirmButton={<ConfirmDialog.ConfirmButton onClick={onConfirm}>이동하기</ConfirmDialog.ConfirmButton>}
      onClose={onCancel}
    />
  );
}
