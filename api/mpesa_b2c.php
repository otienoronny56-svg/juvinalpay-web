<?php
// JuvinalPay B2C Disbursal Engine
function disburseLoan($phone, $amount, $loanId) {
    $url = 'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest';
    
    $curl_post_data = array(
        'InitiatorName' => 'JUVINAL_ADMIN',
        'SecurityCredential' => 'BO8NWilB+R2cI9izA7okeFdf/vzxvCMNK7hTGzKO2+y3tJAYAB3MWpV5JYwUO2rTG2dHj/ngdXqCM4AfvLniIrSNQIiGXW5SCX5vAf2XjYyNmShAWr3bbex6RX+GYbCs0WJGwIY9bFNu8KfuiurjA97Y0tn6yh8Yo1NR5mvWQdzw1weVp5oACcx+jzGGYVTmbwkby1k3fHl1aVsgLCziSgth1a+m543tn+VdggeTYoMwBnEqmcon5xyxswgBR6YEFt9tszvzN1/lxJP0jCjhD7A7pH3TwSTHWlvCzJSJM76roLo1UE5/zz+q7TKy2l/jo6+mS7Z9+2DuEn9pybUIJQ==', // From Safaricom Portal
        'CommandID' => 'BusinessPayment',
        'Amount' => $amount,
        'PartyA' => '4056724', // Your Till/Paybill
        'PartyB' => $phone,
        'Remarks' => 'Loan Disbursal ID: ' . $loanId,
        'QueueTimeOutURL' => 'https://yourdomain.com/b2c_timeout.php',
        'ResultURL' => 'https://yourdomain.com/b2c_result.php',
        'Occasion' => 'Loan'
    );

    // Standard M-Pesa OAuth and Curl execution follows...
}
?>