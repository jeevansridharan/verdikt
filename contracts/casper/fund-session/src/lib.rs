#![no_std]
#![no_main]

extern crate alloc;

use casper_contract::contract_api::{runtime, system};
use casper_types::{runtime_args, ContractHash, RuntimeArgs, U512};

#[no_mangle]
pub extern "C" fn call() {
    let contract_hash: ContractHash = runtime::get_named_arg("contract_hash");
    let project_id: u32 = runtime::get_named_arg("project_id");
    let amount: U512 = runtime::get_named_arg("amount");

    runtime::call_contract::<()>(
        contract_hash,
        "fund_project",
        runtime_args! {
            "project_id" => project_id,
            "source_purse" => system::get_main_purse(),
            "amount" => amount,
        },
    );
}
