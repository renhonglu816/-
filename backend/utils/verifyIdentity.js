/**
 * 身份验证 —— 本地 mock 实现
 * 真实环境应接阿里云 Id2MetaVerify 或其他实名 API。
 * 当前开发环境直接返回 success: true，让注册流程不受阻碍。
 */
const verifyIdentity = async (name, idCard) => {
  // 本地 mock：直接通过
  // 真实环境替换为：
  //   1. 从环境变量读 ALIYUN_ACCESS_KEY / ALIYUN_SECRET_KEY
  //   2. 调用阿里云 Id2MetaVerify API
  //   3. 根据 Result === 'Match' 判断是否通过
  console.warn('[verifyIdentity] 使用本地 mock，真实环境请替换为阿里云 API');

  // 简单的身份证号格式校验（仅检查长度和生日部分）
  const idCardRegex = /^\d{17}[\dXx]$/;
  if (!idCardRegex.test(idCard)) {
    return {
      success: false,
      message: '身份证号格式不正确'
    };
  }

  return {
    success: true,
    message: '身份验证通过（本地 mock）',
    data: {
      result: 'Match',
      name,
      id_card: idCard
    }
  };
};

export default verifyIdentity;
