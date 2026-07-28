export const clampGpa = (value) => Math.min(100, Math.max(0, Number(value) || 0));

export function calculateWeightedGpa(courses = []) {
    return courses.reduce((result, course) => {
        const grade = Number(course?.pivot?.grade);
        const hours = Number(course?.credit_hours) || 0;
        if (!Number.isFinite(grade) || grade <= 0 || hours <= 0) return result;
        result.hours += hours;
        result.points += grade * hours;
        result.gpa = result.points / result.hours;
        return result;
    }, { hours: 0, points: 0, gpa: 0 });
}

export function calculateGoalProjection({
    currentGpa,
    completedHours,
    targetGpa,
    plannedHours,
    expectedSemesterGpa,
}) {
    const current = clampGpa(currentGpa);
    const target = clampGpa(targetGpa);
    const expected = clampGpa(expectedSemesterGpa);
    const completed = Math.max(0, Number(completedHours) || 0);
    const planned = Math.max(1, Number(plannedHours) || 1);
    const expectedCumulative = ((current * completed) + (expected * planned)) / (completed + planned);
    const requiredSemesterGpa = ((target * (completed + planned)) - (current * completed)) / planned;
    const remainingDifference = Math.max(0, target - expectedCumulative);
    const progressPercentage = target > current
        ? Math.min(100, Math.max(0, ((expectedCumulative - current) / (target - current)) * 100))
        : 100;

    let status = 'possible';
    let statusLabel = 'ممكن';
    if (current >= target) {
        status = 'achieved';
        statusLabel = 'تم تحقيق الهدف';
    } else if (requiredSemesterGpa > 100) {
        status = 'impossible';
        statusLabel = 'غير ممكن حاليًا';
    } else if (requiredSemesterGpa >= 90) {
        status = 'hard';
        statusLabel = 'صعب';
    }

    const recommendation = status === 'achieved'
        ? 'حافظ على أدائك الحالي واختر حملًا دراسيًا متوازنًا.'
        : status === 'impossible'
            ? 'خفّض الهدف المرحلي أو وزّعه على أكثر من فصل.'
            : status === 'hard'
                ? 'الهدف ممكن لكنه يحتاج فصلًا قويًا؛ خفّف المواد مرتفعة الصعوبة.'
                : `استهدف معدلًا فصليًا لا يقل عن ${Math.max(0, requiredSemesterGpa).toFixed(1)}%.`;

    return {
        expectedCumulativeGpa: expectedCumulative,
        remainingDifference,
        requiredSemesterGpa,
        progressPercentage,
        status,
        statusLabel,
        recommendation,
    };
}
